# cosmos.so unofficial

A Figma and FigJam plugin for [Cosmos](https://www.cosmos.so). Browse and search your Cosmos boards inside Figma, drag images onto the canvas or place a whole board at once, and save layers back to Cosmos.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/mockup-dark.png">
  <img src="docs/mockup-light.png" alt="The plugin window in Figma showing a Cosmos board with a search field, an image grid, and the buttons Place all and Upload 2 layers">
</picture>

This is not official Cosmos software. It is an independent project with no affiliation to, endorsement by or support from Cosmos. The Cosmos name and logo belong to Cosmos and are used here only to describe what the plugin connects to. The plugin is not on the Figma Community and will only be published there with Cosmos's permission.

## What it does

- Lists your boards and their sections, and searches inside them by meaning, the way cosmos.so does.
- Drag an image onto the canvas, or click it to place it in the middle of the view. Images arrive as the original files at full resolution.
- Place all puts every image of a board or a search into a new section, after a confirmation that shows the count.
- Upload selection saves the selected layers to the picked board as 2x PNGs.
- Follows Figma's light and dark theme, in Figma and FigJam.

## Try it

1. Clone or download this repository.
2. In the Figma desktop app, choose Plugins, Development, Import plugin from manifest, and pick `manifest.json`.
3. Run the plugin from Plugins, Development, and sign in with your Cosmos email or username and password.

## How it works

There is no build step and no server. Figma loads the files as they are.

| File | Job |
| --- | --- |
| `manifest.json` | Plugin definition and the three allowed domains |
| `code.js` | Runs on the canvas. Places images, lays out Place all, exports the selection and keeps the session in Figma's plugin storage |
| `ui.html` | The interface and the Cosmos client, with every API call in one `<script id="cosmos">` block |
| `check.mjs` | Tests for the client and the layout, run with `node check.mjs` |
| `docs/` | The mockups and their source, the icon and a draft Community listing |

The plugin uses the GraphQL API behind cosmos.so, the same one the web app and the Save to Cosmos extension use.

| Operation | Purpose |
| --- | --- |
| `auth.login`, `auth.refreshAccessToken`, `auth.logout`, `me` | Sign-in and session |
| `clusters`, `clusterConnections` | Boards, sections and their images |
| `searchElements` | Search inside a board |
| `s3PostPolicyForImageUpload`, `element.createFromImage` | Upload |

## Privacy

- The password goes only to Cosmos's sign-in endpoint over HTTPS and is never stored.
- Cosmos's tokens stay in Figma's plugin storage on your device. Sign out deletes them and ends the session.
- Every request carries `x-client-name: figma-plugin-unofficial`, so Cosmos can tell this traffic apart.
- Network access is limited to `api.www.cosmos.so`, `cdn.cosmos.so` and `s3.amazonaws.com`.

## Limits

- Videos are skipped.
- Images above Figma's 4096 px limit, and formats Figma cannot read, come in as resized PNGs.
- Search returns up to 500 results, ranked by relevance.

## For the Cosmos team

I built this for my own work and would like to share it with other Cosmos users on the Figma Community, with your permission. I am happy to move it to an official API or OAuth, rename it, change the branding, or hand it over to you. Open an issue here or reach me on [GitHub](https://github.com/marco-vrinssen).

## License

MIT for the code. The Cosmos name and logo belong to Cosmos.
