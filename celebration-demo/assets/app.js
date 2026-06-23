/* =============================================================
   Celebration Homes AI demo — shared chat engine
   - Scripted-rails player (Page 1 / Scenario A): instant, offline-safe, ends in a CTA.
   - Live-call client (Page 2 / Scenario B): POST {scenario, messages} -> n8n -> {reply},
     with a mock/echo mode and a timeout -> scripted fallback so the demo never dead-ends.
   - One continuous chat: the conversation persists in sessionStorage, so the homepage
     bubble carries into the Adriana page and survives close/minimize + reload.
   No framework. Mobile-first. (See CLAUDE.md hard rules.)
   ============================================================= */
(function () {
  'use strict';

  // ---- Config (per-page override via window.CELEBRATION_CONFIG) ----
  var CFG = Object.assign({
    USE_MOCK: true,                 // flip to false once the n8n webhook URL is set
    WEBHOOK_URL: '',                // paste production webhook URL (see n8n/workflow-notes.md)
    LIVE_TIMEOUT_MS: 9000,          // client-side timeout -> scripted fallback
    SCENARIOS_URL: 'data/scenarios.json',
    DATA_URL: 'data/adriana.json',
    TYPING_MIN_MS: 700,             // simulated "thinking" for scripted turns
    TYPING_MAX_MS: 1400
  }, window.CELEBRATION_CONFIG || {});

  // Shared secret for the n8n webhook. NOT a real secret — it ships in client
  // source and is visible to anyone who views it. It only deters casual/bot
  // abuse of the public demo endpoint; the real API key stays in n8n.
  var DEMO_KEY = 'chs_demo_8Kq2vR9xWp4n';

  // ---- tiny helpers ----
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rand(a, b) { return a + Math.floor(Math.random() * (b - a)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ============================================================
  // Conversation persistence (one session across both pages)
  // ============================================================
  var CHAT_KEY = 'cel_chat';     // array of {role, content, fallback}
  var STAGE_KEY = 'cel_stage';   // 'home' | 'listing'
  function loadChat() { try { return JSON.parse(sessionStorage.getItem(CHAT_KEY)) || []; } catch (e) { return []; } }
  function saveChat(a) { try { sessionStorage.setItem(CHAT_KEY, JSON.stringify(a)); } catch (e) {} }
  function pushChat(entry) { var a = loadChat(); a.push(entry); saveChat(a); }
  function resetChat() { saveChat([]); try { sessionStorage.setItem(STAGE_KEY, 'home'); } catch (e) {} }
  function getStage() { try { return sessionStorage.getItem(STAGE_KEY); } catch (e) { return null; } }
  function setStage(s) { try { sessionStorage.setItem(STAGE_KEY, s); } catch (e) {} }

  // ============================================================
  // Chat UI primitives (shared)
  // ============================================================
  function ChatUI(root) {
    this.root = root;
    this.log = root.querySelector('[data-chat-log]');
    this.form = root.querySelector('[data-chat-form]');
    this.input = root.querySelector('[data-chat-input]');
    this.suggts = root.querySelector('[data-chat-suggestions]');
    this.history = []; // {role, content} mirror for live calls
  }
  ChatUI.prototype.scroll = function () { this.log.scrollTop = this.log.scrollHeight; };

  // pure DOM renderers (no persistence) -------------------------
  ChatUI.prototype._userBubble = function (text) {
    var row = el('div', 'msg msg--user');
    row.appendChild(el('div', 'bubble', esc(text)));
    this.log.appendChild(row);
    this.scroll();
  };
  ChatUI.prototype._botBubble = function (text, opts) {
    opts = opts || {};
    var row = el('div', 'msg msg--bot');
    row.appendChild(el('div', 'avatar', 'CH'));
    var bubble = el('div', 'bubble', esc(text));
    if (opts.fallback) bubble.appendChild(el('div', 'bubble-tag', 'offline answer'));
    row.appendChild(bubble);
    this.log.appendChild(row);
    this.scroll();
    return row;
  };

  // public: render + record to history + persist ---------------
  ChatUI.prototype.addUser = function (text, opts) {
    opts = opts || {};
    this._userBubble(text);
    this.history.push({ role: 'user', content: text });
    if (!opts.noStore) pushChat({ role: 'user', content: text });
  };
  ChatUI.prototype.addBot = function (text, opts) {
    opts = opts || {};
    var row = this._botBubble(text, opts);
    if (!opts.noHistory) this.history.push({ role: 'assistant', content: text });
    if (!opts.noStore) pushChat({ role: 'assistant', content: text, fallback: !!opts.fallback });
    return row;
  };

  // replay a persisted transcript (no re-store) ----------------
  ChatUI.prototype.restore = function () {
    var a = loadChat();
    a.forEach(function (e) {
      if (e.role === 'user') this._userBubble(e.content);
      else this._botBubble(e.content, { fallback: e.fallback });
      this.history.push({ role: e.role, content: e.content });
    }, this);
    return a.length;
  };

  ChatUI.prototype.showTyping = function () {
    var row = el('div', 'msg msg--bot typing-row');
    row.appendChild(el('div', 'avatar', 'CH'));
    row.appendChild(el('div', 'bubble typing', '<span></span><span></span><span></span>'));
    this.log.appendChild(row);
    this.scroll();
    return row;
  };
  ChatUI.prototype.clearSuggestions = function () { if (this.suggts) this.suggts.innerHTML = ''; };
  ChatUI.prototype.renderSuggestions = function (items, onPick) {
    if (!this.suggts) return;
    this.suggts.innerHTML = '';
    items.forEach(function (label) {
      var b = el('button', 'chip', esc(label));
      b.type = 'button';
      b.addEventListener('click', function () { onPick(label); });
      this.suggts.appendChild(b);
    }, this);
  };
  ChatUI.prototype.setEnabled = function (on) {
    if (this.input) this.input.disabled = !on;
    var btn = this.form && this.form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = !on;
  };

  // ============================================================
  // Scenario data loading
  // ============================================================
  function loadScenarios() { return fetch(CFG.SCENARIOS_URL).then(function (r) { return r.json(); }); }
  function findScenario(data, id) { return (data.scenarios || []).filter(function (s) { return s.id === id; })[0]; }

  // Adriana floorplan facts, cached so live calls can ground Claude's answers.
  var adrianaData = null;
  function loadData() { return fetch(CFG.DATA_URL).then(function (r) { return r.json(); }); }

  // Anthropic needs messages starting with 'user' and alternating roles —
  // merge consecutive same-role turns and drop any leading assistant turns.
  function sanitizeForApi(history) {
    var out = [];
    history.forEach(function (m) {
      if (out.length === 0 && m.role !== 'user') return;
      var last = out[out.length - 1];
      if (last && last.role === m.role) last.content += '\n\n' + m.content;
      else out.push({ role: m.role, content: m.content });
    });
    return out;
  }

  // ============================================================
  // PAGE 1 — Scripted rails player (Scenario A)
  // ============================================================
  function initScriptedPage(opts) {
    var root = document.querySelector('[data-chat]');
    if (!root) return;
    var ui = new ChatUI(root);

    // The homepage is the start of the demo: reset the conversation each visit.
    resetChat();

    loadScenarios().then(function (data) {
      var sc = findScenario(data, opts.scenarioId || 'general_to_listing');
      if (!sc) return;
      var turns = sc.turns || [];
      var step = 0;

      ui.addBot(opts.greeting || "Hi! I'm the Celebration Homes advisor. What brings you in today?", { noHistory: true });

      function refreshSuggestion() {
        ui.clearSuggestions();
        if (step < turns.length) {
          ui.renderSuggestions([turns[step].suggested_user], function (label) { playTurn(label); });
        }
      }

      function playTurn(userText) {
        if (step >= turns.length) return;
        var turn = turns[step];
        ui.clearSuggestions();
        ui.setEnabled(false);
        ui.addUser(userText);
        var typing = ui.showTyping();
        sleep(rand(CFG.TYPING_MIN_MS, CFG.TYPING_MAX_MS)).then(function () {
          typing.remove();
          // scripted assistant lines are stored (for continuity) but kept out of the
          // live-API history (noHistory) — they re-seed from the store on page 2.
          ui.addBot(turn.assistant, { noHistory: true });
          if (turn.ui && turn.ui.navigate_to) renderCTA(turn.ui);
          step++;
          if (step < turns.length) { ui.setEnabled(true); refreshSuggestion(); }
        });
      }

      function renderCTA(uiSpec) {
        var row = el('div', 'msg msg--bot cta-row');
        row.appendChild(el('div', 'avatar', 'CH'));
        var wrap = el('div', 'cta-wrap');
        var a = el('a', 'btn', esc(uiSpec.cta_label || 'View the Adriana →'));
        a.href = uiSpec.navigate_to + '?from=homepage&plan=adriana';
        a.addEventListener('click', function () {
          try { sessionStorage.setItem('cel_from', 'homepage'); sessionStorage.setItem('cel_plan', 'adriana'); } catch (e) {}
        });
        wrap.appendChild(a);
        row.appendChild(wrap);
        ui.log.appendChild(row);
        ui.scroll();
      }

      ui.form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = (ui.input.value || '').trim();
        if (!v) return;
        ui.input.value = '';
        playTurn(v);
      });

      refreshSuggestion();
    });
  }

  // ============================================================
  // PAGE 2 — Live-call client (Scenario B) with mock + fallback
  // ============================================================
  function mockReply(messages) {
    // Local canned replies (floorplan-grounded) so the page is testable before n8n exists.
    var last = messages[messages.length - 1];
    var q = (last && last.content || '').toLowerCase();
    if (q.indexOf('bonus room') > -1 || q.indexOf('garage') > -1)
      return "Yes — on the Adriana the bonus room over the garage is an available structural option, adding about 320 sq ft of finished space. Since the price depends on your selections, I'll have Greg confirm the exact figure for your build. Want me to connect you?";
    if (q.indexOf('bedroom') > -1)
      return "The Adriana is a 4-bedroom plan that can go up to 5, with a flexible room downstairs and an optional bonus over the garage. It's 3,249 sq ft with 3 baths and a 2-3 car garage. Want Greg to walk you through the layouts?";
    if (q.indexOf('floor') > -1 || q.indexOf('finish') > -1)
      return "You can upgrade to luxury vinyl plank through the main living or engineered hardwood, and step up from Designer Collection I (included) to Collection II. Since it's built to order, you'd pick finishes during your selections appointment — want me to have Greg set one up?";
    if (q.indexOf('timeline') > -1 || q.indexOf('move in') > -1 || q.indexOf('how long') > -1 || q.indexOf('build') > -1)
      return "The Adriana is built to order, so most homes take about 6-12 months from contract to move-in, depending on selections and homesite. Greg can map out a timeline for your situation — want me to connect you?";
    return "Happy to help with the Adriana! In live mode this answer comes from Claude, grounded on the Adriana floorplan data. For pricing or contract specifics I'll loop in Greg, our Ashlyn sales manager — want me to connect you?";
  }

  function callLive(history) {
    var messages = sanitizeForApi(history);
    if (CFG.USE_MOCK || !CFG.WEBHOOK_URL) {
      return sleep(rand(900, 1600)).then(function () { return mockReply(messages); });
    }
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, CFG.LIVE_TIMEOUT_MS);
    var payload = { scenario: 'listing_qa', demo_key: DEMO_KEY, messages: messages };
    if (adrianaData) payload.adriana_data = adrianaData;
    return fetch(CFG.WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    }).then(function (r) {
      clearTimeout(timer);
      if (r.status === 401) { var e = new Error('unauthorized'); e.unauthorized = true; throw e; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      if (j && j.error === 'unauthorized') { var e2 = new Error('unauthorized'); e2.unauthorized = true; throw e2; }
      if (!j || !j.reply) throw new Error('no reply');
      return j.reply;
    });
  }

  function initLivePage(opts) {
    var root = document.querySelector('[data-chat]');
    if (!root) return;
    var ui = new ChatUI(root);

    // grab floorplan facts for grounding (best-effort; chat works without them)
    loadData().then(function (d) { adrianaData = d; }).catch(function () {});

    loadScenarios().then(function (data) {
      var sc = findScenario(data, opts.scenarioId || 'listing_qa') || {};
      var fallbacks = sc.scripted_fallback || {};
      var handoff = sc.handoff_line || "I'll have Greg confirm that directly — want me to connect you?";

      // resume the conversation carried over from the homepage (or a prior visit)
      var hadHistory = ui.restore() > 0;

      // add the listing intro once per session (first time we reach the Adriana page)
      if (getStage() !== 'listing') {
        ui.addBot(
          (hadHistory
            ? "Here's the Adriana floorplan — ask me anything about the layouts, options, or timeline."
            : "Welcome to the Adriana floorplan. Ask me anything about the layouts, options, or build timeline."),
          { noHistory: true }
        );
        setStage('listing');
      }

      function bestFallback(userText) {
        if (fallbacks[userText]) return fallbacks[userText];
        var q = userText.toLowerCase();
        var keys = Object.keys(fallbacks);
        for (var i = 0; i < keys.length; i++) {
          if (q.indexOf(keys[i].toLowerCase().slice(0, 12)) > -1) return fallbacks[keys[i]];
        }
        return handoff;
      }

      function ask(userText) {
        ui.clearSuggestions();
        ui.addUser(userText);
        ui.setEnabled(false);
        var typing = ui.showTyping();

        callLive(ui.history.slice()).then(function (reply) {
          typing.remove();
          ui.addBot(reply);
        }).catch(function (err) {
          typing.remove();
          if (err && err.unauthorized) {
            ui.addBot("This demo isn't available right now.", { fallback: true });
          } else {
            ui.addBot(bestFallback(userText), { fallback: true });
          }
          if (window.console) console.warn('live call failed, used fallback:', err && err.message);
        }).then(function () {
          ui.setEnabled(true);
          ui.input && ui.input.focus();
        });
      }

      if (sc.seed_suggestions && sc.seed_suggestions.length) {
        ui.renderSuggestions(sc.seed_suggestions, ask);
      }

      ui.form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = (ui.input.value || '').trim();
        if (!v) return;
        ui.input.value = '';
        ask(v);
      });
    });
  }

  // ---- no-op lead capture (demo only — never store real PII) ----
  function wireLeadCapture() {
    document.querySelectorAll('[data-lead-form]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        console.log('[demo] lead capture is a no-op — no PII stored.');
        var note = f.querySelector('[data-lead-note]');
        if (note) note.textContent = 'Thanks! (Demo only — nothing was actually submitted.)';
      });
    });
  }

  // ---- Floating chat widget (lower-left bubble launcher) ----
  var _setChatOpen = null;
  function initChatWidget() {
    var fab = document.getElementById('chatFab');
    var btn = document.getElementById('chatFabBtn');
    var win = document.getElementById('chatWindow');
    var close = document.getElementById('chatClose');
    if (!fab || !btn || !win) return;

    function setOpen(open) {
      win.hidden = !open;
      fab.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        var input = win.querySelector('[data-chat-input]');
        if (input) setTimeout(function () { input.focus(); }, 60);
        var log = win.querySelector('[data-chat-log]');
        if (log) log.scrollTop = log.scrollHeight;
      }
    }
    _setChatOpen = setOpen;
    btn.addEventListener('click', function () { setOpen(win.hidden); });
    if (close) close.addEventListener('click', function () { setOpen(false); }); // minimize — session is preserved
    document.querySelectorAll('[data-open-chat]').forEach(function (elm) {
      elm.addEventListener('click', function (e) { e.preventDefault(); setOpen(true); });
    });
  }
  function openChat() { if (_setChatOpen) _setChatOpen(true); }
  function closeChat() { if (_setChatOpen) _setChatOpen(false); }

  // did we arrive here from the homepage chat?
  function cameFromHomepage() {
    try { if (sessionStorage.getItem('cel_from') === 'homepage') return true; } catch (e) {}
    return location.search.indexOf('from=homepage') > -1;
  }

  // ---- Persistent "DEMO" banner (styles in assets/demo-gate.css) ----
  // Injected here so it's defined once and appears on both pages. It's
  // dismissible, but reappears on every page load / navigation (we deliberately
  // do NOT persist the dismissed state) so the disclaimer is always shown.
  function injectDemoBanner() {
    if (document.getElementById('demo-banner')) return;
    var bar = el('div', null);
    bar.id = 'demo-banner';
    bar.innerHTML =
      '<div class="demo-banner__inner">' +
      '<span class="demo-banner__text"><strong>Demo</strong> — Not affiliated with ' +
      'Celebration Homes. Built by Mile Zero Enterprises for evaluation only.</span>' +
      '<button class="demo-banner__close" type="button" aria-label="Dismiss notice">&times;</button>' +
      '</div>';
    document.body.appendChild(bar);

    // Measure the real height (it may wrap on small screens) and reserve exactly
    // that much space at the top of the page so nothing hides behind the banner.
    function syncHeight() {
      var h = bar.offsetHeight || 40;
      document.documentElement.style.setProperty('--demo-banner-h', h + 'px');
    }
    syncHeight();
    window.addEventListener('resize', syncHeight);

    bar.querySelector('.demo-banner__close').addEventListener('click', function () {
      bar.remove();
      document.documentElement.style.setProperty('--demo-banner-h', '0px');
    });
  }
  document.addEventListener('DOMContentLoaded', injectDemoBanner);

  // expose
  window.Celebration = {
    initScriptedPage: initScriptedPage,
    initLivePage: initLivePage,
    initChatWidget: initChatWidget,
    openChat: openChat,
    closeChat: closeChat,
    cameFromHomepage: cameFromHomepage,
    wireLeadCapture: wireLeadCapture,
    config: CFG
  };
  document.addEventListener('DOMContentLoaded', wireLeadCapture);
})();
