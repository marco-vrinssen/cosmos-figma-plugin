# Privacy

Cosmos Unofficial is an independent Figma and FigJam plugin by Marco Vrinssen. It has no server of its own and no analytics. This page was last updated on 2026-10-10.

## What goes to Cosmos

- When you sign in, your email or username and your password go once over HTTPS to Cosmos's sign-in endpoint at `api.www.cosmos.so`.
- When you browse, search, import or create collections, the plugin asks `api.www.cosmos.so` for your collections and their items with Cosmos's access token. Images and videos load from `cdn.cosmos.so`.
- When you click Upload selection, a PNG of each selected design goes to Cosmos's upload storage on `s3.amazonaws.com` and then into the collection you picked.
- The sign-in screen loads Cosmos's own public picks as its background, without any account data.
- Every Cosmos API request carries `x-client-name: figma-plugin-unofficial`, so Cosmos can tell this traffic apart.

Cosmos handles this data under its [privacy policy](https://www.cosmos.so/legal/privacy-policy).

## What stays on your device

- Cosmos's access token, refresh token and your Cosmos user id, in Figma's plugin storage (`figma.clientStorage`). Sign out deletes them and ends the Cosmos session.
- Your GIF and image crop settings, in the same storage.
- Your password is never stored.

## What the developer receives

Nothing. The plugin sends no data to the developer or to any service other than Cosmos.

## Contact

- Questions go to the [issues page](https://github.com/marco-vrinssen/cosmos-figma-plugin/issues).
- Security issues go privately through [GitHub's vulnerability reporting](https://github.com/marco-vrinssen/cosmos-figma-plugin/security/advisories/new).
