// Canvas side: session storage, placing images and exporting the selection.
// Every Cosmos API call lives in ui.html, because only the iframe can send multipart uploads.

// Drops onto these nodes land inside them, like Figma's own image drop.
const CONTAINERS = ['FRAME', 'SECTION', 'COMPONENT'];

// Place all lays a board out like Cosmos does: equal columns, each image into the shortest one.
const COLUMN = 400;
const GAP = 16;
const PADDING = 40;

// Image downloads in flight while placing a whole board.
const PARALLEL = 6;

figma.showUI(__html__, { width: 320, height: 560, themeColors: true });

figma.clientStorage.getAsync('session').then((session) => {
  figma.ui.postMessage({ type: 'session', session: session || null });
  postSelection();
});

figma.on('selectionchange', postSelection);

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'save-session') await saveSession(msg.session);
  if (msg.type === 'place') await place(msg.image, figma.currentPage, figma.viewport.center.x, figma.viewport.center.y);
  if (msg.type === 'place-all') await placeAll(msg.images, msg.name);
  if (msg.type === 'export') await exportSelection();
  if (msg.type === 'notify') figma.notify(msg.text, { error: Boolean(msg.error) });
};

// Only drops sent by the plugin UI carry dropMetadata.cosmos. Anything else keeps Figma's default drop.
figma.on('drop', (event) => {
  const image = event.dropMetadata && event.dropMetadata.cosmos;
  if (!image) return true;

  const inside = CONTAINERS.includes(event.node.type);
  const parent = inside ? event.node : figma.currentPage;
  place(image, parent, inside ? event.x : event.absoluteX, inside ? event.y : event.absoluteY);
  return false;
});

function postSelection() {
  figma.ui.postMessage({ type: 'selection', count: figma.currentPage.selection.length });
}

function saveSession(session) {
  return session ? figma.clientStorage.setAsync('session', session) : figma.clientStorage.deleteAsync('session');
}

// The original file first, the resized PNG when Figma cannot read the original's format or size.
function loadImage(image) {
  const resized = () => figma.createImageAsync(image.src);
  return image.original ? figma.createImageAsync(image.original).catch(resized) : resized();
}

// Centers the image on the drop point at its pixel size, the way Figma places dropped files.
async function place(image, parent, x, y) {
  try {
    const img = await loadImage(image);
    const size = await img.getSizeAsync();
    const rect = figma.createRectangle();
    rect.name = image.name;
    rect.resize(size.width, size.height);
    rect.fills = [{ type: 'IMAGE', imageHash: img.hash, scaleMode: 'FILL' }];
    parent.appendChild(rect);
    rect.x = x - size.width / 2;
    rect.y = y - size.height / 2;
    figma.currentPage.selection = [rect];
  } catch (err) {
    figma.notify(`Could not place image: ${err.message}`, { error: true });
  }
}

// Builds the whole layout from the known image sizes first, then fills the placeholders as images arrive.
async function placeAll(images, name) {
  const layout = masonry(images);
  const center = figma.viewport.center;
  const section = figma.createSection();
  section.name = name;
  section.resizeWithoutConstraints(layout.width + 2 * PADDING, layout.height + 2 * PADDING);
  section.x = Math.round(center.x - section.width / 2);
  section.y = Math.round(center.y - section.height / 2);

  const rects = layout.cells.map((cell, i) => {
    const rect = figma.createRectangle();
    rect.name = images[i].name;
    rect.resize(cell.width, cell.height);
    section.appendChild(rect);
    rect.x = PADDING + cell.x;
    rect.y = PADDING + cell.y;
    return rect;
  });
  figma.currentPage.selection = [section];
  figma.viewport.scrollAndZoomIntoView([section]);

  let done = 0;
  let failed = 0;
  await eachLimit(images, PARALLEL, async (image, i) => {
    try {
      const img = await loadImage(image);
      rects[i].fills = [{ type: 'IMAGE', imageHash: img.hash, scaleMode: 'FILL' }];
    } catch (err) {
      rects[i].remove();
      failed += 1;
    }
    done += 1;
    figma.ui.postMessage({ type: 'progress', text: `Placing ${done} of ${images.length}` });
  });

  const placed = images.length - failed;
  figma.notify(failed ? `Placed ${placed} images, ${failed} failed to load` : `Placed ${placed} images from ${name}`);
  figma.ui.postMessage({ type: 'placed' });
}

// The square root of the image count as column count keeps the section roughly square.
function masonry(images) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(images.length)));
  const heights = new Array(columns).fill(0);
  const cells = images.map((image) => {
    const column = heights.indexOf(Math.min(...heights));
    const height = image.width && image.height ? Math.round((COLUMN * image.height) / image.width) : COLUMN;
    const cell = { x: column * (COLUMN + GAP), y: heights[column], width: COLUMN, height };
    heights[column] += height + GAP;
    return cell;
  });
  return { cells, width: columns * (COLUMN + GAP) - GAP, height: Math.max(...heights) - GAP };
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
    for (const node of figma.currentPage.selection) {
      files.push(await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } }));
    }
    figma.ui.postMessage({ type: 'exported', files });
  } catch (err) {
    figma.ui.postMessage({ type: 'exported', files: [], error: `Could not export: ${err.message}` });
  }
}
