// Runs the Cosmos client from ui.html against a mocked fetch, plus the placement logic from code.js: `node check.mjs`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('ui.html', import.meta.url), 'utf8');
const src = html.match(/<script id="cosmos">([\s\S]*?)<\/script>/)[1];
const mainSrc = readFileSync(new URL('code.js', import.meta.url), 'utf8');

function load(responses) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body });
    const [status, json] = responses.shift();
    return { status, ok: status < 400, json: async () => json };
  };
  const parent = { postMessage: () => {} };
  const api = new Function('fetch', 'parent', `${src}
    return { gql, uploadPng, searchItems, createBoard, canvasWidth, getSession: () => session, setSession: (s) => { session = s; } };`)(fetch, parent);
  return { api, calls };
}

const authError = { errors: [{ message: 'unauthenticated', extensions: { code: 'AUTHENTICATION' } }] };

// An expired token refreshes once, keeps the user id and retries with the new token.
{
  const { api, calls } = load([
    [200, authError],
    [200, { data: { auth: { refreshAccessToken: { accessToken: 'a2', refreshToken: 'r2' } } } }],
    [200, { data: { me: { id: 7 } } }],
  ]);
  api.setSession({ accessToken: 'a1', refreshToken: 'r1', userId: 7 });
  assert.deepEqual(await api.gql('query Me { me { id } }'), { me: { id: 7 } });
  assert.deepEqual(api.getSession(), { accessToken: 'a2', refreshToken: 'r2', userId: 7 });
  assert.equal(calls[1].body.variables.input.refreshToken, 'r1');
  assert.equal(calls[2].init.headers.authorization, 'Bearer a2');
}

// A failed refresh clears the session.
{
  const { api } = load([[200, authError], [401, authError]]);
  api.setSession({ accessToken: 'a1', refreshToken: 'r1', userId: 7 });
  await assert.rejects(api.gql('query Me { me { id } }'), /Session expired/);
  assert.equal(api.getSession(), null);
}

// Upload posts the policy fields to S3, then creates the element from the key with the PNG size.
{
  const policyString = JSON.stringify({
    conditions: [
      { bucket: 'bucket-x' },
      ['eq', '$key', 'images/abc'],
      { acl: 'private' },
      ['starts-with', '$Content-Type', 'image/'],
      { 'x-amz-credential': 'cred' },
      { 'x-amz-algorithm': 'AWS4-HMAC-SHA256' },
      { 'x-amz-date': '20261005T000000Z' },
    ],
  });
  const { api, calls } = load([
    [200, { data: { s3PostPolicyForImageUpload: { signature: 'sig', policyString, policyBase64String: 'b64' } } }],
    [204, null],
    [200, { data: { element: { created: { id: 1 } } } }],
  ]);
  api.setSession({ accessToken: 'a1', refreshToken: 'r1', userId: 7 });

  const png = new Uint8Array(24);
  new DataView(png.buffer).setUint32(16, 640);
  new DataView(png.buffer).setUint32(20, 480);
  await api.uploadPng(png, '42');

  assert.equal(calls[1].url, 'https://s3.amazonaws.com/bucket-x');
  const form = calls[1].body;
  assert.equal(form.get('key'), 'images/abc');
  assert.equal(form.get('Content-Type'), 'image/png');
  assert.equal(form.get('X-Amz-Credential'), 'cred');
  assert.equal(form.get('Policy'), 'b64');
  assert.equal(form.get('X-Amz-Signature'), 'sig');
  assert.deepEqual(calls[2].body.variables.input, { userId: 7, mediaKey: 'images/abc', width: 640, height: 480, clusterId: '42' });
}

// Search stays inside the board. Images, GIFs and videos each get a still for the grid and a file to place.
{
  const cdn = 'https://cdn.cosmos.so/';
  const element = (id, media, caption = null) => ({ element: { id, generatedCaption: caption && { text: caption }, media } });
  const { api, calls } = load([
    [200, { data: { searchElements: {
      results: [
        element(1, { __typename: 'StaticImage', url: `${cdn}a`, width: 1600, height: 1200 }, 'A <n>chair</n>'),
        element(2, { __typename: 'AnimatedImage', url: `${cdn}g`, width: 498, height: 266, staticThumbnailUrl: `${cdn}g.jpg` }),
        element(3, { __typename: 'Video', url: `${cdn}v.mp4`, width: 1920, height: 1080, duration: 7, thumbnail: { url: `${cdn}v` } }),
        element(4, { __typename: 'Video', url: 'https://stream.example/v.mp4', width: 1, height: 1, thumbnail: { url: `${cdn}x` } }),
        element(5, { __typename: 'StaticImage', url: `${cdn}huge`, width: 8192, height: 1200 }),
        { element: { id: 6, generatedCaption: null } },
      ],
      meta: { nextPageCursor: null, count: 6 },
    } } }],
  ]);
  api.setSession({ accessToken: 'a1', refreshToken: 'r1', userId: 7 });

  const { items, count } = await api.searchItems('42', 'chair', null);
  assert.deepEqual(calls[0].body.variables, { searchTerm: 'chair', clusterId: '42', userId: 7, pageCursor: null });
  assert.equal(count, 6);
  assert.deepEqual(items.map((item) => item.kind), ['image', 'gif', 'video', 'image']);

  const [image, gif, video, huge] = items;
  assert.equal(image.name, 'A chair');
  assert.equal(image.original, `${cdn}a`);
  assert.equal(image.src, `${cdn}a?format=png&w=1600`);
  assert.equal(gif.original, `${cdn}g.jpg`);
  assert.equal(gif.animated, `${cdn}g`);
  assert.equal(gif.thumb, `${cdn}g.jpg?format=webp&w=300`);
  assert.equal(video.video, `${cdn}v.mp4`);
  assert.equal(video.original, `${cdn}v`);
  assert.equal(video.duration, 7);
  assert.equal(huge.original, null);
  assert.equal(huge.src, `${cdn}huge?format=png&w=4096`);
}

// A new subcollection goes in with its parent and privacy, and the new id comes back as a string.
{
  const { api, calls } = load([[200, { data: { cluster: { create: { id: 99 } } } }]]);
  api.setSession({ accessToken: 'a1', refreshToken: 'r1', userId: 7 });
  assert.equal(await api.createBoard('Moodboard', '42', true), '99');
  assert.deepEqual(calls[0].body.variables, { userId: 7, name: 'Moodboard', parentClusterId: '42', isPrivate: true });
}

// code.js runs with a stub figma and fetch, and returns its placement functions.
function loadMain({ createImageAsync, createVideoAsync, getImageByHash, fetch } = {}) {
  const figma = {
    showUI() {},
    on() {},
    ui: { postMessage() {} },
    clientStorage: { getAsync: async () => null },
    currentPage: { selection: [] },
    createImageAsync,
    createVideoAsync,
    getImageByHash,
  };
  const exported = 'masonry, arrange, loadImage, fillFor, uploadRoots, exportScale';
  return new Function('figma', '__html__', 'fetch', `${mainSrc}\nreturn { ${exported} };`)(figma, '', fetch);
}

const image = (url) => ({ hash: url, getSizeAsync: async () => ({ width: 10, height: 20 }) });

// An original Figma cannot read, like a WebP, falls back to the resized PNG.
{
  const requested = [];
  const { loadImage } = loadMain({
    createImageAsync: async (url) => {
      requested.push(url);
      if (url.endsWith('.webp')) throw new Error('Image type is unsupported');
      return image(url);
    },
  });

  assert.equal((await loadImage({ original: 'https://cdn.cosmos.so/a.webp', src: 'png-a' })).hash, 'png-a');
  assert.equal((await loadImage({ original: 'https://cdn.cosmos.so/b', src: 'png-b' })).hash, 'https://cdn.cosmos.so/b');
  assert.equal((await loadImage({ original: null, src: 'png-c' })).hash, 'png-c');
  assert.equal(requested.length, 4);
}

// GIFs follow the setting. A video that Figma refuses becomes its first frame and says why.
{
  const { fillFor } = loadMain({
    createImageAsync: async (url) => image(url),
    createVideoAsync: async () => { throw new Error('Video needs a paid plan'); },
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }),
  });
  const gif = { kind: 'gif', animated: 'gif-file', original: 'first-frame', src: 'png' };
  const video = { kind: 'video', video: 'v.mp4', original: 'thumbnail', src: 'png', width: 1920, height: 1080 };

  assert.equal((await fillFor(gif, { gifs: 'animated' })).paint.imageHash, 'gif-file');
  assert.equal((await fillFor(gif, { gifs: 'still' })).paint.imageHash, 'first-frame');
  const still = await fillFor(video, { gifs: 'animated' });
  assert.equal(still.paint.imageHash, 'thumbnail');
  assert.equal(still.stillFrame, 'Video needs a paid plan');
}

// Videos become video fills at the size Cosmos reports.
{
  const { fillFor } = loadMain({
    createVideoAsync: async (bytes) => ({ hash: `video-${bytes.length}` }),
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }),
  });
  const fill = await fillFor({ kind: 'video', video: 'v.mp4', width: 1920, height: 1080 }, { gifs: 'animated' });
  assert.deepEqual(fill, { paint: { type: 'VIDEO', videoHash: 'video-4', scaleMode: 'FILL' }, width: 1920, height: 1080 });
}

// The grid puts each item into the shortest column. Square mode and missing sizes give square cells.
{
  const { masonry } = loadMain();
  const size = (width, height) => ({ width, height });
  const items = [size(400, 800), size(400, 400), size(400, 400), size(400, 200), size(null, null)];
  const layout = masonry(items, false);

  assert.deepEqual(layout.cells[3], { x: 416, y: 416, width: 400, height: 200 });
  assert.deepEqual(layout.cells[4], { x: 832, y: 416, width: 400, height: 400 });
  assert.equal(layout.width, 1232);
  assert.equal(layout.height, 816);

  const square = masonry(items, true);
  assert.ok(square.cells.every((cell) => cell.width === 400 && cell.height === 400));
  assert.deepEqual(square.cells[3], { x: 0, y: 416, width: 400, height: 400 });
}

// A board and its subcollections sit in rows, as many per row as the square root of their count.
{
  const { arrange } = loadMain();
  const spots = arrange([{ width: 100, height: 50 }, { width: 200, height: 80 }, { width: 100, height: 40 }]);

  assert.deepEqual(spots.boxes.map((box) => [box.x, box.y]), [[0, 0], [260, 0], [0, 240]]);
  assert.equal(spots.width, 460);
  assert.equal(spots.height, 280);
}

// Uploads take the outermost design of every selected layer once, and every design in a selected section.
{
  const { uploadRoots } = loadMain();
  const page = { type: 'PAGE' };
  const node = (id, type, parent) => ({ id, type, parent, children: [] });
  const section = node('section', 'SECTION', page);
  const design = node('design', 'FRAME', section);
  const nested = node('nested', 'FRAME', design);
  const deep = node('deep', 'RECTANGLE', nested);
  const loose = node('loose', 'FRAME', page);
  const text = node('text', 'TEXT', loose);
  const shelf = node('shelf', 'SECTION', page);
  shelf.children = [node('a', 'FRAME', shelf), node('b', 'RECTANGLE', shelf)];

  const roots = uploadRoots([deep, nested, text, shelf, loose]);
  assert.deepEqual(roots.map((root) => root.id), ['design', 'loose', 'a', 'b']);
}

// Image layers export at their image's resolution, capped at 4x. Everything else exports at 2x.
{
  const { exportScale } = loadMain({ getImageByHash: () => ({ getSizeAsync: async () => ({ width: 2000, height: 1000 }) }) });
  const imageLayer = (width) => ({ type: 'RECTANGLE', width, fills: [{ type: 'IMAGE', imageHash: 'h' }] });

  assert.equal(await exportScale(imageLayer(400)), 4);
  assert.equal(await exportScale(imageLayer(1000)), 2);
  assert.equal(await exportScale(imageLayer(4000)), 1);
  assert.equal(await exportScale({ type: 'FRAME', width: 400, children: [], fills: [] }), 2);
}

// Canvas images stay within Figma's 4096 px limit on the longer side.
{
  const { api } = load([]);
  assert.equal(api.canvasWidth({ width: 1920, height: 2880 }), 1920);
  assert.equal(api.canvasWidth({ width: 6000, height: 9000 }), 2730);
  assert.equal(api.canvasWidth({ width: null, height: null }), 2048);
}

console.log('ok');
