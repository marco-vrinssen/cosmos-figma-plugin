# Figma Community listing

## In short

- A draft for Figma's publish dialog, in the order it asks.
- It goes live only with Cosmos's permission.
- The icon is `icon.png`, the thumbnail `mockup-light.png`.

## Describe

| Field | Value |
| --- | --- |
| Name | cosmos.so unofficial |
| Tagline | Bring your Cosmos boards into Figma and save layers back. |
| Category | Design tools |

### Description

```text
An unofficial plugin for cosmos.so, not made or endorsed by Cosmos. You need a Cosmos account.

Pick one of your boards or sections, then:
- Browse or search its images.
- Drag an image onto the canvas, or click it to place it in the middle of the view. Images come in at full resolution.
- Click Place all to put every image of the board, or of a search, into a new section.
- Select layers and click Upload selection to save them to the board as 2x PNGs.

To start, run the plugin and sign in with your Cosmos email or username and password.

Your password goes straight to cosmos.so over HTTPS and is never stored. The plugin keeps Cosmos's sign-in tokens in Figma's local plugin storage on your device, and Sign out deletes them. It has no server of its own and only talks to cosmos.so, its image CDN and its upload storage.
```

## Images

| Field | File |
| --- | --- |
| Icon | `icon.png`, 128 × 128 px |
| Thumbnail | `mockup-light.png`, 1920 × 1080 px |

## Data security

| Question | Answer |
| --- | --- |
| Do you host a backend service? | No. |
| Do you have a documented vulnerability management process? | No. Security reports go to the issues page of the repository. |
| Are you accredited to security standards? | No. |
| Do you make network requests with third-party services? | Yes. `api.www.cosmos.so` for the account, boards and uploads, `cdn.cosmos.so` for images, and `s3.amazonaws.com` for Cosmos's upload storage. |
| Does your plugin have user authentication? | Yes, sign-in with the user's own Cosmos account. |
| How do you keep user credentials secure? | The password goes only to Cosmos's sign-in endpoint over HTTPS and is never stored. Cosmos's access and refresh tokens stay in `figma.clientStorage` on the user's device. Sign out deletes them and ends the Cosmos session. |
| Do you store data from Figma's APIs? | No. Selected layers are exported only when the user clicks Upload selection, and they go straight to the user's Cosmos account. |
| How and where is this data stored? | The plugin stores nothing. Uploaded images live in the user's Cosmos account. |
| Who can access this data and what are your handling policies? | Only the user and Cosmos, under Cosmos's privacy policy. The developer has no access. |
| How do you manage plugin updates? | Through Figma's plugin update flow. The source code is public at github.com/marco-vrinssen/cosmos-figma-plugin. |

## Final details

| Field | Value |
| --- | --- |
| Publish to | Community |
| Publish as | Marco Vrinssen |
| Support contact | https://github.com/marco-vrinssen/cosmos-figma-plugin/issues |
| Network access | Restricted, to the three domains in `manifest.json` |
| Comments | Allowed |
| Pricing | Free |
