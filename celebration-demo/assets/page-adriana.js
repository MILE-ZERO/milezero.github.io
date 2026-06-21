/* Page 2 (adriana.html) — hydrate floorplan facts + brochure gallery from
   data/adriana.json, then start the chat. The chat is a lower-left bubble that
   continues the homepage session; it auto-opens when the buyer arrives from the
   homepage chat. The HTML already has sensible static values, so a failed fetch
   never dead-ends the page. */
(function () {
  'use strict';

  function set(sel, val) {
    var n = document.querySelector(sel);
    if (n != null && val != null && val !== '') n.textContent = val;
  }

  function hydrate(data) {
    var fp = data.floorplan || {};
    var sm = (data.community && data.community.sales_manager) || {};

    if (fp.sqft) set('[data-spec-sqft]', Number(fp.sqft).toLocaleString('en-US') + ' sq. ft.');
    set('[data-spec-beds]', fp.beds);
    set('[data-spec-baths]', fp.baths);
    set('[data-spec-garage]', fp.garage);

    set('[data-sm-name]', sm.name);
    var phone = document.querySelector('[data-sm-phone]');
    if (phone && sm.phone) { phone.textContent = sm.phone; phone.href = 'tel:' + sm.phone.replace(/[^\d+]/g, ''); }
    var email = document.querySelector('[data-sm-email]');
    if (email && sm.email) { email.textContent = sm.email; email.href = 'mailto:' + sm.email; }
    var contact = document.querySelector('[data-contact-greg]');
    if (contact && sm.email) contact.href = 'mailto:' + sm.email + '?subject=Adriana%20Floorplan%20Inquiry';
    if (data.pdf_url) { var pdf = document.querySelector('[data-pdf]'); if (pdf) pdf.href = data.pdf_url; }

    if (data.gallery && data.gallery.length) initGallery(data.gallery);
  }

  // ---- brochure gallery carousel ----
  function initGallery(images) {
    var img = document.querySelector('[data-gallery-img]');
    var dots = document.querySelector('[data-gallery-dots]');
    var prev = document.querySelector('[data-gallery-prev]');
    var next = document.querySelector('[data-gallery-next]');
    if (!img) return;
    var i = 0;

    function render() {
      img.src = images[i];
      img.alt = 'Adriana floorplan — page ' + (i + 1) + ' of ' + images.length;
      if (dots) {
        [].forEach.call(dots.children, function (d, idx) { d.className = 'dot' + (idx === i ? ' active' : ''); });
      }
    }
    function go(n) { i = (n + images.length) % images.length; render(); }

    if (dots) {
      dots.innerHTML = '';
      images.forEach(function (_, idx) {
        var d = document.createElement('button');
        d.type = 'button'; d.className = 'dot'; d.setAttribute('aria-label', 'View image ' + (idx + 1));
        d.addEventListener('click', function () { go(idx); });
        dots.appendChild(d);
      });
    }
    if (prev) prev.addEventListener('click', function () { go(i - 1); });
    if (next) next.addEventListener('click', function () { go(i + 1); });
    render();
  }

  // ---- mobile nav toggle (same behavior as homepage) ----
  function initNav() {
    var b = document.getElementById('navBurger'), n = document.getElementById('celNav');
    if (b && n) b.addEventListener('click', function () {
      var open = n.classList.toggle('open');
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // hydrate (best-effort), then start chat + widget regardless
  fetch('data/adriana.json')
    .then(function (r) { return r.json(); })
    .then(hydrate)
    .catch(function (e) { if (window.console) console.warn('listing hydrate skipped:', e && e.message); })
    .then(function () {
      initNav();
      window.Celebration.initLivePage({ scenarioId: 'listing_qa' });
      window.Celebration.initChatWidget();
      // continuity: if the buyer came from the homepage chat, open it automatically
      if (window.Celebration.cameFromHomepage()) {
        window.Celebration.openChat();
        try { sessionStorage.removeItem('cel_from'); } catch (e) {} // so a later reload respects a manual close
      }
    });
})();
