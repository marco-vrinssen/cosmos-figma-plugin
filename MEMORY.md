# cosmos-figma-plugin memory

Updated 2026-10-05. Public reference repo for asking Cosmos's permission to publish. The plugin is not on the Figma Community. The manifest `id` stays `cosmos-figma-plugin` until Figma generates a real one in the publish dialog. Any id change makes Figma drop the stored session, so users sign in once more.

## Publishing

1. Wait for Cosmos's permission.
2. Publish from the personal Figma account, which needs two-factor authentication, with the fields in `docs/listing.md`.
3. Put the ID that Figma generates into `manifest.json`.

## API facts

Cosmos has no public API, and GraphQL introspection is off. When a call breaks, compare it with the requests the cosmos.so web app sends.

- A real account confirmed sign-in, boards, placing and Place all.
- `api.www.cosmos.so/graphql` reflects the `null` origin with credentials allowed.
- Auth failures arrive as HTTP 200 with `errors[].extensions.code` set to `AUTHENTICATION`.
- The API accepts any `x-client-name`. The plugin sends `figma-plugin-unofficial`.
- `clusterConnections` works without a login on public boards and accepts string ids.
- `searchElements` with `filters: { userId, clusterId }` searches one board and answers with up to 500 ranked results in a single page, ignoring `pageSize`.
- The bare `cdn.cosmos.so/<uuid>` URL is the uploaded file, with no content negotiation. Of 802 sampled originals, 97% were JPEG, 2.5% GIF, 3 WebP or AVIF, and 0.6% above 4096 px. Placement loads it first and falls back to `?format=png&w=<px>`.
- CDN responses carry `access-control-allow-origin: *`.

## UI pitfalls

- A `<form method="dialog">` does nothing in an iframe sandbox without `allow-forms`, so the confirm dialog's buttons call `dialog.close(value)` directly.
- Chrome does not repaint `::-webkit-scrollbar` styles that depend on the list's `:hover`, so the scrollbar thumb stays visible.
- Playwright's headless Chrome hides all scrollbars. Check scrollbar styling with `--headed`.
- `docs/mockup.html` renders `ui.html` in a `sandbox="allow-scripts"` srcdoc iframe, the way Figma hosts it, with the theme tokens inlined.

## Not verified yet

- A signed-in session with the `figma-plugin-unofficial` client name.
- Whether S3 sends CORS headers to the `null` origin. `uploadPng` counts an unreadable response as sent.
- Whether Figma's `createImageAsync` rejects a WebP, which the PNG fallback relies on.
