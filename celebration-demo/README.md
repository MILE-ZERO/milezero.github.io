# Celebration Homes — AI Advisor Demo

A two-page, Celebration-Homes-branded demo of an after-hours AI home-buying advisor, built by
Mile Zero Enterprises to pitch replacing the current "leave your email" website chatbot.

- **`index.html`** — homepage, styled to mirror celebrationhomes.com (kitchen hero, intro copy,
  "Communities by City"). The AI advisor is a **floating chat bubble in the lower-left**. Scripted
  **Scenario A**: a relocating buyer with a flexible 6–12 month timeline is answered and guided to the
  Adriana, ending in a CTA that navigates to page 2. Runs with zero backend.
- **`adriana.html`** — the **Adriana** floorplan page (**Ashlyn** community), styled to mirror
  celebrationhomes.com/communities/ashlyn/adriana: brochure gallery, specs (3,249 sq ft · 4–5 bd ·
  3 ba · 2–3 car), and Greg Welton's sales-manager card (Contact / Request Visit/Tour kept). It is a
  built-to-order floorplan — **not** labeled a quick move-in. **Scenario B** runs **live** through
  n8n → Claude, grounded on `data/adriana.json`, with a timeout → scripted fallback.

### One continuous chat (session continuity)
The conversation is persisted in `sessionStorage`, so the same chat carries from the homepage bubble
into the Adriana page. Arriving via the homepage CTA **auto-opens** the bubble and replays the prior
turns; closing/minimizing it preserves the session, and reopening (or reloading) **resumes** where it
left off. The homepage resets the session on load, so each demo run starts clean.

## Run locally
Any static file server rooted at this folder works. For example:

```bash
npx serve .        # then open the printed URL
# or
python -m http.server 5599   # then open http://localhost:5599
```

(Claude Code uses `.claude/launch.json` at the repo root → the **celebration-demo** server.)

## Mock vs. live
`adriana.html` ships in **mock mode** (`USE_MOCK: true` in the page's `CELEBRATION_CONFIG`), returning
canned grounded replies locally so the page is fully testable before n8n exists. To go live:

1. Stand up the n8n workflow (`n8n/celebration-demo-workflow.json`, see `n8n/workflow-notes.md`).
2. In `adriana.html`, set `WEBHOOK_URL` to the production webhook URL and `USE_MOCK: false`.
3. Make sure the n8n CORS **Allowed Origins** matches the deployed page origin.

That's the only change to flip from mock to live.

## Brand tokens (Task 0)
`assets/brand-tokens.css` holds the real Celebration palette/typography, extracted from the live
(JS-rendered) site with headless Chromium. Re-run anytime:

```bash
cd tools && node extract-brand.js   # writes tools/brand-report.json + console digest
```

Key tokens: brand red `#d0252e`, headings **Zalando Sans**, body **Poppins**, pill buttons
**Montserrat** uppercase (30px radius). The logo (`assets/logo.svg`) is a rights-safe typographic
stand-in in the brand colors.

## Self-contained (no external calls)
For demo-day resilience on an unknown venue network, all fonts and hero images are **vendored
locally** — the pages make zero external requests:
- `assets/fonts/*.woff2` + `assets/fonts.css` — self-hosted Google Fonts (OFL), latin subset.
- `assets/img/hero-home.jpg`, `assets/img/adriana-exterior.jpg` — hero photos (Unsplash license).

Re-vendor anytime (e.g. to refresh fonts/images): `cd tools && node vendor-assets.js`.
The only network call the demo ever makes is the live Scenario B chat → your n8n webhook.

## Deploy (GitHub Pages)
Served as a subpage of milezeroenterprises.com at `/celebration-demo/`. All paths are relative, so the
folder drops in as-is. Record the final page origin + webhook URL in `n8n/workflow-notes.md` and
confirm it matches the n8n Allowed Origins.

## Hard rules (see CLAUDE.md)
- No Anthropic API key in the front-end — all live calls go through n8n.
- Don't invent inventory/prices in the UI — ground in `data/adriana.json` (sample data until Greg's real
  brochure arrives; keep the same JSON shape).
- The demo never dead-ends: scripted rails need no backend; live calls have a timeout + fallback.
- Visible "Demo by Mile Zero Enterprises" footer. Lead capture is a no-op; no real PII stored.
