# CLAUDE.md — Celebration Homes AI Demo

Standing instructions for this project. Read the numbered handoff docs (00–07) alongside this file.
The **## Current state & decisions** section below reflects what was actually built and supersedes any
older direction in the numbered docs where they differ.

## What this is
A **two-page**, Celebration-Homes-branded AI home-buying assistant demo. Used to pitch Celebration's COO (Randall) and owner (Corey) on replacing their current "we're not here right now, leave your email" website chatbot. Anchored on the **Adriana floorplan** in the **Ashlyn community** (celebrationhomes.com/communities/ashlyn). Built by Mile Zero Enterprises (Andy).

## Architecture (don't change without asking)
- **Front-end:** two static pages — `index.html` (homepage) and `adriana.html` (Adriana floorplan page). HTML+CSS+vanilla JS, shared `assets/app.js`. Mobile-first. No framework.
- **Hosting:** GitHub Pages, as a subpage of milezeroenterprises.com (`/celebration-demo/`). Static only.
- **Backend:** n8n webhook → Anthropic Claude Messages API. The API key lives in n8n, **never** in the browser. See `03-architecture-n8n.md` and `07-n8n-build-guide.md`.
- **Flow:** A single chat bubble (lower-left) runs the whole conversation. On the homepage it plays scripted Scenario A and ends in a CTA to the Adriana page. The Adriana page continues the **same** conversation live (Scenario B) for floorplan/options/timeline Q&A, grounded on Adriana data, with a scripted fallback. See `05-scenarios.json`.

## Hard rules
- **Never put the Anthropic API key (or any secret) in front-end code.** All live model calls go through the n8n webhook.
- **Don't invent inventory or prices in the UI.** Ground answers in `data/adriana.json`. Sample option/finish ranges stand in until Greg's real Adriana brochure data replaces them — keep the same JSON shape.
- **The demo must never dead-end.** Scripted rails work with zero backend; live calls have a timeout + scripted fallback so a network/API hiccup during the pitch is invisible.
- Keep a visible "Demo by Mile Zero Enterprises" footer. This is a proposal, not a live spoof of Celebration's real site.
- Lead-capture is a **no-op** for the demo. Do not collect or store real PII.
- **The Adriana is a built-to-order floorplan — never label it a "quick move-in."**

## Current state & decisions (this build)
- **Homepage mirrors the real celebrationhomes.com homepage** (kitchen hero, the live site's intro copy
  verbatim, "Communities by City"). It does **not** pitch the "after-hours / old-chatbot" contrast — that
  framing lives in the pitch slide deck, not on the page. The "Get Started" CTA is replaced by **"Ask the
  Advisor,"** which opens the chat bubble.
- **Adriana page mirrors the real floorplan page** (`/communities/ashlyn/adriana`): brochure-image gallery,
  a specs table (**3,249 sq ft · 4–5 bd · 3 ba · 2–3 car garage**), and **Greg Welton's** sales-manager card.
  The **Contact** and **Request Visit/Tour** buttons are kept (they route to Greg). No "Make it yours"
  options grid — the real page doesn't have one (options data still lives in `data/adriana.json` for the chat).
- **The chat is one continuous session.** It's a floating bubble in the lower-left on both pages. The
  conversation persists in `sessionStorage`: arriving from the homepage CTA auto-opens the bubble and replays
  the prior turns; closing/minimizing preserves it; reopening or reloading resumes it. The homepage resets the
  session on load so each demo run starts clean.
- **Scenario A buyer** is relocating with a flexible **6–12 month** timeline (a built-to-order fit), not a
  rush buyer. **Scenario B** answers floorplan/options/**build-timeline** questions and hands off to **Greg**
  for pricing/contract specifics.
- **Self-contained / zero external calls:** fonts (`assets/fonts/`) and the homepage hero are vendored locally;
  the Adriana gallery uses Celebration's own brochure images, vendored to `assets/img/adriana/`. The only
  network call the demo makes is the live Scenario B chat → n8n.

## Brand (done — Task 0)
Tokens extracted from the live (JS-rendered) site via headless Chromium → `assets/brand-tokens.css`:
brand red **`#d0252e`**, headings **Zalando Sans**, body **Poppins**, pill buttons **Montserrat** uppercase
(30px radius). The logo (`assets/logo.svg`) is a rights-safe typographic stand-in in the brand colors/fonts.
Re-extract: `cd tools && node extract-brand.js`. Re-vendor fonts/hero: `node vendor-assets.js`.

## Build order (delivered)
0. ✅ Extract brand tokens (headless browser). 1. ✅ Scaffold both pages. 2. ✅ Scripted Scenario A in the
homepage chat bubble + CTA to Page 2. 3. ✅ Live-call client → n8n for Scenario B (mock mode until the webhook
URL lands). 4. ✅ Match both pages to the live site, session continuity, mobile polish. 5. ⏳ Deploy to GitHub
Pages under `/celebration-demo/` (pending webhook URL). Full detail in `02-build-spec.md`.

## Needs confirmation from Andy before/while building
- n8n production webhook URL + Claude model string (then set `WEBHOOK_URL` and `USE_MOCK:false` in `adriana.html`).
- Real Adriana brochure data from Greg (swap into `data/adriana.json`, same shape).

## Definition of done
On-brand and matching the live site; mobile-ok; Scenario A scripted end-to-end with a CTA to Page 2; Scenario B
live + grounded with a scripted fallback (no dead spinners); one continuous chat that carries across pages and
resumes after close/reload; Greg's Contact / Request Visit/Tour kept; not labeled a quick move-in; deployed at a
shareable URL.
