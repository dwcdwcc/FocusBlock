# FocusBlock Companion Extension

Chrome/Edge MV3 extension. Polls the FocusBlock desktop app at
`http://127.0.0.1:47823/blocklist` every 5s and uses `declarativeNetRequest`
to redirect blocked domains to `blocked.html` in real time (no tab reload
needed).

## Install (dev / unpacked)

1. Run FocusBlock desktop app (`npm run dev` from `C:\Users\Admin\focusblock`).
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** → select `C:\Users\Admin\focusblock\extension`.
5. Visit a blocked domain — should redirect immediately to the FocusBlock blocked page.

Verify the desktop endpoint manually:

```
curl http://127.0.0.1:47823/blocklist
```

## Files
- `manifest.json` — MV3 manifest, requests `declarativeNetRequest` + host permissions
- `background.js` — service worker: polls blocklist, rewrites dynamic rules
- `blocked.html` / `blocked.js` — redirect target shown in-tab
- `icons/` — (optional) extension icons

## Notes
- Time tracking stays in the desktop app (active-win); extension is enforcement only.
- If the desktop app is not running, polls fail silently — existing rules remain
  until the service worker is reloaded or rules are cleared.
- Domain matching uses `requestDomains` so subdomains are covered automatically.
  Do **not** prefix domains with `www.` in the FocusBlock blocklist.
