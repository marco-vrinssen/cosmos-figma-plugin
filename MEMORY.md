# cosmos-figma-plugin memory

Updated 2026-10-05. Public reference repo for asking Cosmos's permission to publish. The plugin is not on the Figma Community. The manifest `id` stays `cosmos-figma-plugin` until Figma generates a real one in the publish dialog. Any id change makes Figma drop the stored session, so users sign in once more.

## Publishing

1. Wait for Cosmos's permission.
2. Publish from the personal Figma account, which needs two-factor authentication, with the fields in `docs/listing.md`.
3. Put the ID that Figma generates into `manifest.json`.

## API facts

Cosmos has no public API, and GraphQL introspection is off. When a call breaks, compare it with the requests the cosmos.so web app sends.

- A real account confirmed sign-in, boards, placing and importing a whole board in a grid.
- `api.www.cosmos.so/graphql` reflects the `null` origin with credentials allowed.
- Auth failures arrive as HTTP 200 with `errors[].extensions.code` set to `AUTHENTICATION`.
- The API accepts any `x-client-name`. The plugin sends `figma-plugin-unofficial`.
- `clusterConnections` works without a login on public boards and accepts string ids.
- `searchElements` with `filters: { userId, clusterId }` searches one board and answers with up to 500 ranked results in a single page, ignoring `pageSize`.
- The bare `cdn.cosmos.so/<uuid>` URL is the uploaded file, with no content negotiation. Of 802 sampled originals, 97% were JPEG, 2.5% GIF, 3 WebP or AVIF, and 0.6% above 4096 px. Placement loads it first and falls back to `?format=png&w=<px>`.
- CDN responses carry `access-control-allow-origin: *`.
- A board's `clusterConnections` leaves out most of its subcollections' items. In one sample, 126 of a subcollection's 194 items were missing from the parent. `numberOfElements` counts both, so Import all fetches every subcollection as its own section.
- `subClusters` came back complete, 25 of 25, without paging, and only one level deep.
- `clusterConnections` accepts `pageSize` up to 2000, the size the web app's export uses. Grid imports fetch in pages of 500.
- `AnimatedImage` has the GIF in `url` and a full-size first-frame JPEG in `staticThumbnailUrl`. The CDN ignores `format` on GIFs, so `?format=png` still returns the animated file.
- `Video` has the stored MP4 in `url` on the CDN and a JPEG in `thumbnail.url`. `mux.mp4Url` is a low-quality alternative on `stream.mux.com`, which the manifest does not allow.
- `figma.createVideoAsync` takes MP4, MOV or WebM bytes up to 100 MB and works only in paid Education, Professional and Organization files. code.js fetches the bytes with the sandbox's own `fetch`.
- The sign-in background floats images from cluster `1996613743`, the public picks of Cosmos's own account.
- `cluster.create(input: { name, userId, parentClusterId, isPrivate })` creates collections and, with a parent, subcollections, the way the Save to Cosmos extension does. Names are capped at 24 characters and may not start with an underscore. New collections default to public on cosmos.so. In the plugin a subcollection starts with its parent's privacy.
- Cosmos lists a new upload in `clusterConnections` only after processing it, so the plugin shows placeholders and checks the first page every 2 seconds for up to a minute. Thumbnails retry five times, because the CDN can answer 404 right after processing.
- Upload selection resolves each selected layer to its outermost layer below the page or a section, drops duplicates, and expands a selected section into its designs. Image layers export at their image's resolution, capped at 4x, everything else at 2x.

## UI pitfalls

- A `<form method="dialog">` does nothing in an iframe sandbox without `allow-forms`, so the confirm dialog's buttons call `dialog.close(value)` directly.
- Chrome does not repaint `::-webkit-scrollbar` styles that depend on the list's `:hover`, so the scrollbar thumb stays visible.
- Playwright's headless Chrome hides all scrollbars. Check scrollbar styling with `--headed`.
- `docs/mockup.html` renders `ui.html` in a `sandbox="allow-scripts"` srcdoc iframe, the way Figma hosts it, with the theme tokens inlined.
- Settings sit in a native `popover`, and segmented controls are styled radio groups, so keyboard and screen readers work without extra code.
- Figma offers no component library for plugin UIs. The UI3 kit is a Figma file, and FigUI3 (`rogie/figui3`, MIT core) is about 900 KB, keeps its Figma-style menu in a PolyForm Shield part, and makes the sliding segmented indicator an opt-in. The plugin matches UI3 by hand instead.
- Inter, Figma's interface typeface, is embedded at the end of `ui.html` as a 48 KB Latin subset with the 400 to 600 weight axis. Many machines lack Inter, and the axis gives Figma's 450 and 550 weights.
- The board picker is a `popover` listbox styled like Figma's dark menus, because a native `<select>` opens the operating system's menu.

## Reference

GatherOS (Figma Community plugin `1677775235799832482`, by Abhijit Rout) imports public Cosmos collections only, with all or pick-by-image, aspect-ratio crops, sections per subcollection, and videos as first frames. This plugin adds private boards, search, video fills and uploads.

## Not verified yet

- A signed-in session with the `figma-plugin-unofficial` client name.
- Whether S3 sends CORS headers to the `null` origin. `uploadPng` counts an unreadable response as sent.
- Whether Figma's `createImageAsync` rejects a WebP, which the PNG fallback relies on.
- Video fills and animated GIF fills on a real canvas, and the `popover` settings inside Figma's plugin iframe.
- Creating a collection and uploading several designs with a real account.
