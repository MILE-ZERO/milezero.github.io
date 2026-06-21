# n8n workflow notes — webhook URL + CORS

Track 2 (Andy, manual ~15 min). Claude Code can't reach your n8n instance, so this is filled in by hand.

## 1. Import the workflow
Import `celebration-demo-workflow.json` into n8n, or build the 3 nodes per `07-n8n-build-guide.md`
(Webhook → HTTP Request to Anthropic → Respond to Webhook). Store the Anthropic key as a
**Header Auth** credential — never in the front-end.

## 2. Production webhook URL
Paste it here once activated, then drop it into the front-end:

```
WEBHOOK_URL = "<paste production webhook URL here>"
```

Front-end wiring: in `adriana.html`, set `window.CELEBRATION_CONFIG.WEBHOOK_URL` to this value
and set `USE_MOCK = false`. That's the only change needed to go from mock → live.

## 3. CORS (easy to miss)
The browser Origin will be the GitHub Pages origin. Set the Webhook node response headers to match:

- `Access-Control-Allow-Origin: https://milezeroenterprises.com`  (or your exact Pages origin; `*` for local testing)
- `Access-Control-Allow-Headers: content-type`
- Handle the `OPTIONS` preflight (enable "Respond to preflight" or allow-all in the Respond node).

Page origin (fill in once deployed): `____________________`
Must exactly match the n8n Allowed Origins.

## 4. Contract (front-end ↔ n8n)
POST body:  `{ "scenario": "listing_qa", "messages": [ { "role": "user", "content": "..." } ] }`
Response:   `{ "reply": "..." }`
