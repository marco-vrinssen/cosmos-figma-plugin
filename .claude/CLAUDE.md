# cosmos-figma-plugin

@../MEMORY.md

## Rules

- No build step. Figma loads `manifest.json`, `code.js` and `ui.html` as they are.
- `code.js` stays free of `?.` and `??`, which older Figma sandboxes rejected. `ui.html` runs in Chromium.
- Every Cosmos API call stays in the `<script id="cosmos">` block of `ui.html`. `check.mjs` extracts and tests that block, so run `node check.mjs` after changing it.
- A new network host needs an entry in `networkAccess.allowedDomains`, or Figma blocks the request.
- After a UI change, render `docs/mockup-light.png` and `docs/mockup-dark.png` again from `docs/mockup.html`.
- Inter is embedded as base64 in the last `<style>` block of `ui.html`. New CSS goes into the first one.

## Memory

Project memory lives in `MEMORY.md` and is shared through git. Claude's machine-local auto memory is off for this repo (`.claude/settings.json`).

- At the end of a session, update `MEMORY.md`: state, decisions, open items, date.
- Commit it with the change it describes.
- This repo is public, so `MEMORY.md` is public too. Nothing personal or secret goes in.
