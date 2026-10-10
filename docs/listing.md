# Figma Community listing

## In short

- The fields for Figma's publish dialog, in the order it asks. The upload kit's `Texts.txt` holds the same text.
- Cosmos has allowed the publication. That is no endorsement, so the description keeps the not affiliated sentence.
- The icon is `icon.png`, the cover `mockup-light.png`.

## Describe

| Field | Value |
| --- | --- |
| Name | Cosmos Unofficial |
| Tagline | Bring your Cosmos collections into Figma and save designs back. |
| Category | Design tools |
| Subcategory | Import & export |
| Tags | cosmos, moodboard, inspiration, import, upload |

### Description

```text
Cosmos Unofficial is an independent plugin, not affiliated with or endorsed by Cosmos. You need a Cosmos account.

Pick one of your collections or subcollections, private ones included, or create a new one, then:
• Browse or search its images, GIFs and videos
• Drag an item onto the canvas, or click it to place it at full resolution
• In Select mode, pick items and import them in a grid
• In All mode, import the whole collection with each subcollection in its own section, or every search result, up to 500 items at a time
• Choose original ratios or square crops that keep the whole file
• Keep GIFs animated or import them as stills. Videos arrive as video fills in paid Figma Design files, elsewhere as their first frame
• Select designs and click Upload selection to save them to the collection. Nested frames go up as their whole outermost design

To start, run the plugin and sign in with your Cosmos email or username and password.

Your password goes straight to cosmos.so over HTTPS and is never stored. The plugin keeps Cosmos's sign-in tokens in Figma's local plugin storage on your device, and Sign out deletes them. It has no server of its own and only talks to cosmos.so, its image CDN and its upload storage.

Privacy policy: https://github.com/marco-vrinssen/cosmos-figma-plugin/blob/main/PRIVACY.md
Source code: https://github.com/marco-vrinssen/cosmos-figma-plugin
```

## Images

| Field | File |
| --- | --- |
| Icon | `icon.png`, 128 × 128 px |
| Cover | `mockup-light.png`, 1920 × 1080 px |

## Data security

| Question | Answer |
| --- | --- |
| Do you host a backend service? | No. |
| Do you have a documented vulnerability management process? | No formal process. Security issues are reported privately through GitHub's private vulnerability reporting at https://github.com/marco-vrinssen/cosmos-figma-plugin/security/advisories/new. |
| Are you accredited to security standards? | No. |
| Do you make network requests with third-party services? | Yes. api.www.cosmos.so for the account, collections and uploads, cdn.cosmos.so for images, and s3.amazonaws.com for Cosmos's upload storage. |
| Does your plugin have user authentication? | Yes, sign-in with the user's own Cosmos account. Cosmos offers no OAuth, so the plugin asks for the Cosmos email or username and password in its own window. |
| How do you keep user credentials secure? | The password goes only to Cosmos's sign-in endpoint over HTTPS and is never stored. Cosmos's access and refresh tokens stay in figma.clientStorage on the user's device. Sign out deletes them and ends the Cosmos session. |
| Do you store data from Figma's APIs? | No. Selected layers are exported only when the user clicks Upload selection, and they go straight to the user's Cosmos account. |
| How and where is this data stored? | Uploaded images live in the user's Cosmos account. On the user's device, figma.clientStorage holds only Cosmos's sign-in tokens, the Cosmos user id and the plugin's two settings. The developer stores nothing. |
| Who can access this data and what are your handling policies? | Only the user and Cosmos, under Cosmos's privacy policy. The developer has no access. The plugin's privacy policy is at https://github.com/marco-vrinssen/cosmos-figma-plugin/blob/main/PRIVACY.md. |
| How do you manage plugin updates? | Through Figma's plugin update flow. The source code is public at github.com/marco-vrinssen/cosmos-figma-plugin. |

## Final details

| Field | Value |
| --- | --- |
| Support contact | https://github.com/marco-vrinssen/cosmos-figma-plugin/issues |
| Network access | Restricted: https://api.www.cosmos.so, https://cdn.cosmos.so, https://s3.amazonaws.com |
| Network access reason | Signs in to your Cosmos account, loads your collections and their images from Cosmos's CDN, and uploads selected designs to Cosmos's storage. No data goes anywhere else. |
| Publish to | Community |
| Publish as | Marco Vrinssen |
| Comments | Allowed |
| Pricing | Free |
