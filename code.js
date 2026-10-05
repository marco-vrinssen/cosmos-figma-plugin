// Canvas side: session and settings storage, placing images and videos, exporting the selection.
// Every Cosmos API call lives in ui.html, because only the iframe can send multipart uploads.

// Drops onto these nodes land inside them, like Figma's own image drop.
const CONTAINERS = ['FRAME', 'SECTION', 'COMPONENT'];

// Import in grid lays a board out like Cosmos does: equal columns, each item into the shortest one.
const COLUMN = 400;
const GAP = 16;
const PADDING = 40;

// Space between the sections of a board and its subcollections.
const SECTION_GAP = 160;

// Downloads in flight during a grid import.
const PARALLEL = 6;

const DEFAULTS = { gifs: 'animated', crop: 'original' };

figma.showUI(__html__, { width: 320, height: 600, themeColors: true });

Promise.all([figma.clientStorage.getAsync('session'), figma.clientStorage.getAsync('settings')]).then(([session, settings]) => {
  figma.ui.postMessage({ type: 'init', session: session || null, settings: Object.assign({}, DEFAULTS, settings) });
  postSelection();
});

figma.on('selectionchange', postSelection);

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'save-session') await save('session', msg.session);
  if (msg.type === 'save-settings') await save('settings', msg.settings);
  if (msg.type === 'place') await place(msg.item, msg.options, figma.currentPage, figma.viewport.center.x, figma.viewport.center.y);
  if (msg.type === 'import-grid') await importGrid(msg.groups, msg.options);
  if (msg.type === 'export') await exportSelection();
  if (msg.type === 'notify') figma.notify(msg.text, { error: Boolean(msg.error) });
  if (msg.type === 'upload-progress') showProgress(msg.text);
  if (msg.type === 'upload-done') {
    hideProgress();
    figma.notify(msg.text, { error: Boolean(msg.error) });
  }
};

// Uploads report through Figma's own toast, whose native Cancel button stops the files not yet sent.
let progress = null;

function showProgress(text) {
  hideProgress();
  const action = () => figma.ui.postMessage({ type: 'cancel-upload' });
  progress = figma.notify(text, { timeout: Infinity, button: { text: 'Cancel', action } });
}

function hideProgress() {
  if (progress) progress.cancel();
  progress = null;
}

// Only drops sent by the plugin UI carry dropMetadata.cosmos. Anything else keeps Figma's default drop.
figma.on('drop', (event) => {
  const drop = event.dropMetadata && event.dropMetadata.cosmos;
  if (!drop) return true;

  const inside = CONTAINERS.includes(event.node.type);
  const parent = inside ? event.node : figma.currentPage;
  place(drop.item, drop.options, parent, inside ? event.x : event.absoluteX, inside ? event.y : event.absoluteY);
  return false;
});

function postSelection() {
  figma.ui.postMessage({ type: 'selection', count: uploadRoots(figma.currentPage.selection).length });
}

// A layer inside a design uploads the whole design, so nested frames never go up on their own.
// A selected section uploads each design in it.
function uploadRoots(selection) {
  const roots = [];
  const seen = new Set();
  const add = (node) => {
    if (node.type === 'SECTION') {
      for (const child of node.children) add(child);
    } else if (!seen.has(node.id)) {
      seen.add(node.id);
      roots.push(node);
    }
  };
  for (const node of selection) add(outermost(node));
  return roots;
}

// The outermost layer below the page or a section, which is where a design ends.
function outermost(node) {
  let root = node;
  while (root.parent && root.parent.type !== 'PAGE' && root.parent.type !== 'SECTION') root = root.parent;
  return root;
}

// Image layers go up at the resolution of their image, everything else at 2x.
async function exportScale(node) {
  const fills = 'fills' in node && Array.isArray(node.fills) ? node.fills : [];
  const fill = !('children' in node) && fills.length === 1 && fills[0].type === 'IMAGE' ? fills[0] : null;
  const image = fill && fill.imageHash ? figma.getImageByHash(fill.imageHash) : null;
  if (!image) return 2;
  const size = await image.getSizeAsync();
  return Math.min(4, Math.max(1, size.width / node.width));
}

function save(key, value) {
  return value ? figma.clientStorage.setAsync(key, value) : figma.clientStorage.deleteAsync(key);
}

// The original file first, the resized PNG when Figma cannot read the original's format or size.
function loadImage(item) {
  const resized = () => figma.createImageAsync(item.src);
  return item.original ? figma.createImageAsync(item.original).catch(resized) : resized();
}

// GIFs stay animated when the setting asks for it. Videos become video fills where the file's plan
// allows it. Both fall back to their first frame.
async function fillFor(item, options) {
  if (item.kind === 'video') {
    try {
      return await videoFill(item);
    } catch (err) {
      return Object.assign(await imageFill(loadImage(item)), { stillFrame: err.message || 'Video is not available here.' });
    }
  }
  const animate = item.kind === 'gif' && item.animated && options.gifs === 'animated';
  return imageFill(animate ? figma.createImageAsync(item.animated).catch(() => loadImage(item)) : loadImage(item));
}

async function imageFill(loading) {
  const image = await loading;
  const size = await image.getSizeAsync();
  return { paint: { type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }, width: size.width, height: size.height };
}

// Free plans and FigJam reject video, which sends the item down the first-frame path.
async function videoFill(item) {
  const res = await fetch(item.video);
  if (!res.ok) throw new Error(`Video download failed (${res.status})`);
  const video = await figma.createVideoAsync(new Uint8Array(await res.arrayBuffer()));
  return { paint: { type: 'VIDEO', videoHash: video.hash, scaleMode: 'FILL' }, width: item.width, height: item.height };
}

// Centers the item on the drop point at its pixel size, the way Figma places dropped files.
async function place(item, options, parent, x, y) {
  try {
    const fill = await fillFor(item, options);
    const rect = figma.createRectangle();
    rect.name = item.name;
    rect.resize(fill.width, fill.height);
    rect.fills = [fill.paint];
    parent.appendChild(rect);
    rect.x = x - fill.width / 2;
    rect.y = y - fill.height / 2;
    figma.currentPage.selection = [rect];
    if (fill.stillFrame) figma.notify(`Placed the first frame instead of the video. ${fill.stillFrame}`);
  } catch (err) {
    figma.notify(`Could not place: ${err.message}`, { error: true });
  }
}

// Builds every section from the known sizes first, then fills the placeholders as files arrive.
// Square cells keep the whole file in a FILL paint, so a layer can be resized back to its original.
async function importGrid(groups, options) {
  const square = options.crop === 'square';
  const layouts = groups.map((group) => masonry(group.items, square));
  const spots = arrange(layouts.map((layout) => ({ width: layout.width + 2 * PADDING, height: layout.height + 2 * PADDING })));
  const center = figma.viewport.center;
  const sections = [];
  const jobs = [];

  groups.forEach((group, i) => {
    const section = figma.createSection();
    section.name = group.name;
    section.resizeWithoutConstraints(spots.boxes[i].width, spots.boxes[i].height);
    section.x = Math.round(center.x - spots.width / 2 + spots.boxes[i].x);
    section.y = Math.round(center.y - spots.height / 2 + spots.boxes[i].y);
    layouts[i].cells.forEach((cell, j) => {
      const rect = figma.createRectangle();
      rect.name = group.items[j].name;
      rect.resize(cell.width, cell.height);
      section.appendChild(rect);
      rect.x = PADDING + cell.x;
      rect.y = PADDING + cell.y;
      jobs.push({ item: group.items[j], rect });
    });
    sections.push(section);
  });
  figma.currentPage.selection = sections;
  figma.viewport.scrollAndZoomIntoView(sections);

  let done = 0;
  let failed = 0;
  let stills = 0;
  await eachLimit(jobs, PARALLEL, async ({ item, rect }) => {
    try {
      // One retry absorbs a dropped download in a long import.
      const fill = await fillFor(item, options).catch(() => fillFor(item, options));
      rect.fills = [fill.paint];
      if (fill.stillFrame) stills += 1;
    } catch (err) {
      rect.remove();
      failed += 1;
    }
    done += 1;
    figma.ui.postMessage({ type: 'progress', text: `Importing ${done} of ${jobs.length}` });
  });

  const imported = jobs.length - failed;
  const where = sections.length > 1 ? `${sections.length} sections` : `“${groups[0].name}”`;
  const notes = [`Imported ${imported} ${imported === 1 ? 'item' : 'items'} into ${where}`];
  if (failed) notes.push(`${failed} failed to load`);
  if (stills) notes.push(stills === 1 ? '1 video as its first frame' : `${stills} videos as first frames`);
  figma.notify(notes.join(', '));
  figma.ui.postMessage({ type: 'imported' });
}

// The square root of the item count as column count keeps a section roughly square.
function masonry(items, square) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(items.length)));
  const heights = new Array(columns).fill(0);
  const cells = items.map((item) => {
    const column = heights.indexOf(Math.min(...heights));
    const height = !square && item.width && item.height ? Math.round((COLUMN * item.height) / item.width) : COLUMN;
    const cell = { x: column * (COLUMN + GAP), y: heights[column], width: COLUMN, height };
    heights[column] += height + GAP;
    return cell;
  });
  return { cells, width: columns * (COLUMN + GAP) - GAP, height: Math.max(...heights) - GAP };
}

// Rows of sections, as many per row as the square root of their count.
function arrange(sizes) {
  const perRow = Math.max(1, Math.ceil(Math.sqrt(sizes.length)));
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let width = 0;
  const boxes = sizes.map((size, i) => {
    if (i > 0 && i % perRow === 0) {
      x = 0;
      y += rowHeight + SECTION_GAP;
      rowHeight = 0;
    }
    const box = { x, y, width: size.width, height: size.height };
    x += size.width + SECTION_GAP;
    rowHeight = Math.max(rowHeight, size.height);
    width = Math.max(width, x - SECTION_GAP);
    return box;
  });
  return { boxes, width, height: y + rowHeight };
}

async function eachLimit(items, limit, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function exportSelection() {
  try {
    const files = [];
    for (const node of uploadRoots(figma.currentPage.selection)) {
      const scale = await exportScale(node);
      files.push(await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale } }));
    }
    figma.ui.postMessage({ type: 'exported', files });
  } catch (err) {
    figma.ui.postMessage({ type: 'exported', files: [], error: `Could not export: ${err.message}` });
  }
}
