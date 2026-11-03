# cosmos-figma-plugin

Figma plugin Cosmos Unofficial. `README.md` covers features and install, `PRIVACY.md` what it stores and sends, `docs/listing.md` the Community listing texts.

## Rules

- No build step. Figma loads `manifest.json`, `code.js` and `ui.html` as they are.
- Every Cosmos API call stays in the `<script id="cosmos">` block of `ui.html`. `check.mjs` extracts and tests that block, so run `node check.mjs` after changing it. `marco-vrinssen/cosmos-mcp` started from this block, so a query fix here likely applies there too.
- After a UI change, render `docs/mockup-light.png` and `docs/mockup-dark.png` again from `docs/mockup.html`.
- Inter is embedded as base64 in the last `<style>` block of `ui.html`. New CSS goes into the first one.
- Inter ships as a 48 KB Latin subset with the 400 to 600 weight axis. The axis gives Figma's 450 and 550 weights.
- The manifest `id` is `cosmos-figma-plugin` until publish. Any later id change drops the stored session, so users sign in again.
- FigUI3 (`rogie/figui3`) was rejected. Its menu is under PolyForm Shield, it weighs about 900 KB and its sliding segmented indicator is opt-in.
- Settings sit in a native `popover`, so keyboard and screen readers work without extra code.
- Busy buttons swap their label for UI3's spinner after 150 ms. The spinner is a 270 degree arc turning once a second, as in FigUI3.
- Uploads longer than a second also get a `figma.notify` toast with `timeout: Infinity` and a Cancel button.
- A `<form method="dialog">` does nothing in the iframe sandbox without `allow-forms`, so dialog buttons call `dialog.close(value)` directly.
- The scrollbar thumb stays visible, because Chrome does not repaint `::-webkit-scrollbar` styles that depend on the list's `:hover`.
- The sign-in background floats images from cluster `1996613743`, the public picks of Cosmos's own account.

## Cosmos API

- Cosmos has no public API and GraphQL introspection is off. When a call breaks, compare it with the requests the cosmos.so web app sends.
- The plugin signs in with the client name `figma-plugin-unofficial`. The API accepts any `x-client-name`.
- `api.www.cosmos.so/graphql` reflects the iframe's `null` origin with credentials allowed. The CDN sends `access-control-allow-origin: *`. S3 accepts the upload from the `null` origin.
- Detect auth failures by `errors[].extensions.code` set to `AUTHENTICATION`. Cosmos sends them as HTTP 200.
- `clusterConnections` works without a login on public boards and accepts string ids. It takes `pageSize` up to 2000. Grid imports fetch in pages of 500.
- A board's `clusterConnections` leaves out most subcollection items, while `numberOfElements` counts them. So Import all fetches every subcollection as its own section.
- `subClusters` returns all subcollections without paging, one level deep.
- `searchElements` with `filters: { userId, clusterId }` searches one board. It returns up to 500 ranked results in one page and ignores `pageSize`.
- `cluster.create(input: { name, userId, parentClusterId, isPrivate })` creates collections and subcollections. Names are capped at 24 characters and may not start with an underscore.
- New collections default to public. The plugin starts a subcollection with its parent's privacy.
- The bare `cdn.cosmos.so/<uuid>` URL is the uploaded file, with no content negotiation. Placement loads it first and falls back to `?format=png&w=<px>`.
- A GIF still comes from `staticThumbnailUrl`, a full-size first-frame JPEG. The CDN ignores `format` on GIFs, so `?format=png` still returns the animation.
- A video loads the stored MP4 from `url` on the CDN and its still from `thumbnail.url`. `mux.mp4Url` is lower quality and sits on `stream.mux.com`, which the manifest does not allow.
- `figma.createVideoAsync` takes MP4, MOV or WebM up to 100 MB, only in paid Education, Professional and Organization files. `code.js` fetches the bytes with the sandbox's own `fetch`.
- Upload selection resolves each layer to its outermost layer below the page or a section. It drops duplicates and expands a selected section.
- Image layers export at their image's resolution capped at 4x, everything else at 2x.
- Cosmos lists a new upload only after processing it. The CDN can answer 404 right after that. Keep the placeholders, the check of the first page every 2 seconds for up to a minute and the five thumbnail retries.

## Checks

- `node check.mjs` tests the Cosmos block offline.
- `docs/mockup.html` renders `ui.html` the way Figma hosts it, in a `sandbox="allow-scripts"` srcdoc iframe with the theme tokens inlined.
- Playwright's headless Chrome hides all scrollbars. Check scrollbar styling with `--headed`.
