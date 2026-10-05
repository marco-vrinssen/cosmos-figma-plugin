// Runs the Cosmos client from ui.html against a mocked fetch, plus the Place all layout from code.js: `node check.mjs`.
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
    return { gql, uploadPng, searchImages, canvasWidth, getSession: () => session, setSession: (s) => { session = s; } };`)(fetch, parent);
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

// Search stays inside the board and keeps only CDN images. Originals load as they are unless Figma's 4096 px limit rules them out.
{
  const media = (url, __typename = 'StaticImage', width = 1600) => ({ __typename, url, width, height: 1200 });
  const { api, calls } = load([
    [200, { data: { searchElements: {
      results: [
        { element: { id: 1, generatedCaption: { text: 'A <n>chair</n>' }, media: media('https://cdn.cosmos.so/a') } },
        { element: { id: 2, generatedCaption: null, media: media('https://cdn.cosmos.so/v', 'Video') } },
        { element: { id: 3, generatedCaption: null, media: media('https://elsewhere.example/b') } },
        { element: { id: 4, generatedCaption: null } },
        { element: { id: 5, generatedCaption: null, media: media('https://cdn.cosmos.so/huge', 'StaticImage', 8192) } },
      ],
      meta: { nextPageCursor: null, count: 5 },
    } } }],
  ]);
  api.setSession({ accessToken: 'a1', refreshToken: 'r1', userId: 7 });

  const page = await api.searchImages('42', 'chair', null);
  assert.deepEqual(calls[0].body.variables, { searchTerm: 'chair', clusterId: '42', userId: 7, pageCursor: null });
  assert.equal(page.images.length, 2);
  assert.equal(page.images[0].name, 'A chair');
  assert.equal(page.images[0].original, 'https://cdn.cosmos.so/a');
  assert.equal(page.images[0].src, 'https://cdn.cosmos.so/a?format=png&w=1600');
  assert.equal(page.images[1].original, null);
  assert.equal(page.images[1].src, 'https://cdn.cosmos.so/huge?format=png&w=4096');
  assert.equal(page.count, 5);
}

const figmaStub = (createImageAsync) => ({
  showUI() {}, on() {}, ui: { postMessage() {} }, clientStorage: { getAsync: async () => null }, currentPage: { selection: [] }, createImageAsync,
});
const loadMain = (figma) => new Function('figma', '__html__', `${mainSrc}\nreturn { masonry, loadImage };`)(figma, '');

// An original Figma cannot read, like a WebP, falls back to the resized PNG.
{
  const requested = [];
  const { loadImage } = loadMain(figmaStub(async (url) => {
    requested.push(url);
    if (url.endsWith('.webp')) throw new Error('Image type is unsupported');
    return { hash: url };
  }));

  assert.equal((await loadImage({ original: 'https://cdn.cosmos.so/a.webp', src: 'https://cdn.cosmos.so/a?format=png' })).hash, 'https://cdn.cosmos.so/a?format=png');
  assert.equal((await loadImage({ original: 'https://cdn.cosmos.so/b', src: 'https://cdn.cosmos.so/b?format=png' })).hash, 'https://cdn.cosmos.so/b');
  assert.equal((await loadImage({ original: null, src: 'https://cdn.cosmos.so/c?format=png' })).hash, 'https://cdn.cosmos.so/c?format=png');
  assert.equal(requested.length, 4);
}

// Place all puts each image into the shortest column, and images without a size become squares.
{
  const { masonry } = loadMain(figmaStub());
  const size = (width, height) => ({ width, height });
  const layout = masonry([size(400, 800), size(400, 400), size(400, 400), size(400, 200), size(null, null)]);

  assert.deepEqual(layout.cells[3], { x: 416, y: 416, width: 400, height: 200 });
  assert.deepEqual(layout.cells[4], { x: 832, y: 416, width: 400, height: 400 });
  assert.equal(layout.width, 1232);
  assert.equal(layout.height, 816);
}

// Canvas images stay within Figma's 4096 px limit on the longer side.
{
  const { api } = load([]);
  assert.equal(api.canvasWidth({ width: 1920, height: 2880 }), 1920);
  assert.equal(api.canvasWidth({ width: 6000, height: 9000 }), 2730);
  assert.equal(api.canvasWidth({ width: null, height: null }), 2048);
}

console.log('ok');
