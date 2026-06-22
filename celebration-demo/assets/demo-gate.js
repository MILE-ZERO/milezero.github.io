/* =============================================================
   Celebration Homes demo — client-side access gate
   Loaded as the FIRST <script> in <head> (blocking, no defer) on BOTH
   index.html and adriana.html, so the page is locked before it renders.

   ⚠️  DETERRENT, NOT REAL SECURITY.  ⚠️
   This is a public static site. This file, the passcode HASH below, and all
   the comparison logic ship in plain client source — anyone who opens DevTools
   or reads the page source can bypass it. It exists only to stop casual /
   accidental visitors and search-engine click-throughs from wandering into the
   demo. Never put anything genuinely sensitive behind it. The real secrets
   (Anthropic API key) live server-side in n8n, never in the browser.

   ──────────────────────────────────────────────────────────────────────────
   ▶▶ TO CHANGE THE PASSCODE:  replace PASSCODE_SHA256 below with the SHA-256
      hash of your new passcode. Generate it with either:
        • Browser console:
            crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOURCODE'))
              .then(b => console.log([...new Uint8Array(b)]
              .map(x => x.toString(16).padStart(2,'0')).join('')))
        • Shell:   printf '%s' 'YOURCODE' | sha256sum
      Current passcode: CELEBRATION2026
   ──────────────────────────────────────────────────────────────────────────
   ============================================================= */
(function () {
  'use strict';

  // SHA-256 hex of the passcode. (Hash of "CELEBRATION2026".) See header to change.
  var PASSCODE_SHA256 = '17395dc5a2ac28a973674aa5a60502cf9a6e720b46eaa510b2fe7e312d292468';

  var SESSION_KEY = 'cel_demo_unlocked';

  // Already unlocked this browser session? Let the page render untouched.
  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;
  } catch (e) { /* sessionStorage blocked (private mode etc.) — fall through and gate */ }

  // Lock immediately. We add the class to <html> (which exists during head
  // parsing) so demo-gate.css hides <body> the instant it parses, before paint.
  var docEl = document.documentElement;
  docEl.classList.add('demo-locked');

  // Critical inline fallback: if demo-gate.css hasn't loaded yet, this guarantees
  // the body stays hidden and the overlay is opaque — nothing leaks unprotected.
  var critical = document.createElement('style');
  critical.textContent =
    'html.demo-locked{overflow:hidden}' +
    'html.demo-locked body{visibility:hidden!important}' +
    '#demo-gate{position:fixed;inset:0;z-index:2147483647;display:flex;' +
    'align-items:center;justify-content:center;background:#6b0f15}';
  docEl.appendChild(critical);

  function buildOverlay() {
    if (document.getElementById('demo-gate')) return;

    var overlay = document.createElement('div');
    overlay.id = 'demo-gate';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Private demo — passcode required');
    overlay.innerHTML = [
      '<form class="demo-gate__card" autocomplete="off">',
      '  <p class="demo-gate__eyebrow">Mile Zero Enterprises</p>',
      '  <h1 class="demo-gate__title">Celebration Homes — Private Demo</h1>',
      '  <p class="demo-gate__hint">Enter the passcode to view this demo.</p>',
      '  <input class="demo-gate__input" type="password" inputmode="text" ',
      '         aria-label="Passcode" placeholder="Passcode" autofocus />',
      '  <button class="demo-gate__btn" type="submit">Unlock</button>',
      '  <p class="demo-gate__error" role="alert">Incorrect passcode. Try again.</p>',
      '  <p class="demo-gate__foot">Deterrent only — this is a public demo, not a secure site.</p>',
      '</form>'
    ].join('\n');

    // Append to <html>, not <body>: body is visibility:hidden while locked.
    docEl.appendChild(overlay);

    var form = overlay.querySelector('.demo-gate__card');
    var input = overlay.querySelector('.demo-gate__input');
    var btn = overlay.querySelector('.demo-gate__btn');
    var err = overlay.querySelector('.demo-gate__error');

    function showError() {
      err.classList.add('is-visible');
      input.classList.add('has-error');
      input.select();
    }
    function clearError() {
      err.classList.remove('is-visible');
      input.classList.remove('has-error');
    }
    input.addEventListener('input', clearError);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var value = input.value || '';
      if (!value) { showError(); return; }
      btn.disabled = true;
      sha256Hex(value).then(function (hex) {
        btn.disabled = false;
        if (hex === PASSCODE_SHA256) {
          unlock();
        } else {
          showError();
        }
      }).catch(function () {
        // SubtleCrypto unavailable (e.g. non-secure context). Fail closed.
        btn.disabled = false;
        showError();
      });
    });

    try { input.focus(); } catch (e) {}
  }

  function unlock() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
    docEl.classList.remove('demo-locked');
    if (critical && critical.parentNode) critical.parentNode.removeChild(critical);
    var overlay = document.getElementById('demo-gate');
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  // Hash the user's input with the Web Crypto API and hex-encode it, so we never
  // store the plaintext passcode — only its SHA-256 digest is in this file.
  function sha256Hex(text) {
    var bytes = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      var arr = Array.prototype.slice.call(new Uint8Array(buf));
      return arr.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  // <body> may not exist yet (we run in <head>). Build as soon as it does.
  if (document.body) {
    buildOverlay();
  } else {
    document.addEventListener('DOMContentLoaded', buildOverlay);
  }
})();
