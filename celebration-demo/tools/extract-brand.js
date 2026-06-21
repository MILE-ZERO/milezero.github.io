// Task 0 — render celebrationhomes.com (JS-rendered) with a headless browser
// and pull palette / fonts / button styles. Output: ../assets/brand-tokens.css
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PAGES = [
  'https://celebrationhomes.com/',
  'https://celebrationhomes.com/communities/ashlyn',
];

function rgbToHex(rgb) {
  const m = rgb && rgb.match(/\d+(\.\d+)?/g);
  if (!m) return null;
  const [r, g, b] = m.map(Number);
  if (m[3] !== undefined && Number(m[3]) === 0) return 'transparent';
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const report = {};

  for (const url of PAGES) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(2500);
    } catch (e) {
      console.error('nav warn', url, e.message);
    }

    const data = await page.evaluate(() => {
      const out = { url: location.href, colorCount: {}, bgCount: {}, fonts: {}, buttons: [], links: [], headings: [], logo: null };
      const tally = (obj, key) => { if (!key) return; obj[key] = (obj[key] || 0) + 1; };

      // body / global font
      const bodyCS = getComputedStyle(document.body);
      out.bodyFont = bodyCS.fontFamily;
      out.bodyColor = bodyCS.color;
      out.bodyBg = bodyCS.backgroundColor;

      const els = Array.from(document.querySelectorAll('*')).slice(0, 6000);
      for (const el of els) {
        const cs = getComputedStyle(el);
        tally(out.colorCount, cs.color);
        tally(out.bgCount, cs.backgroundColor);
        tally(out.fonts, cs.fontFamily);
      }

      // buttons + CTA-ish anchors
      const btnEls = Array.from(document.querySelectorAll('button, .btn, a.button, [class*="button"], [class*="btn"]')).slice(0, 40);
      for (const b of btnEls) {
        const cs = getComputedStyle(b);
        const txt = (b.innerText || '').trim().slice(0, 30);
        if (!txt) continue;
        out.buttons.push({
          text: txt, bg: cs.backgroundColor, color: cs.color,
          border: cs.border, borderRadius: cs.borderRadius,
          font: cs.fontFamily, fontWeight: cs.fontWeight,
          textTransform: cs.textTransform, padding: cs.padding,
          letterSpacing: cs.letterSpacing,
        });
      }

      // headings
      for (const h of ['h1', 'h2', 'h3']) {
        const el = document.querySelector(h);
        if (el) {
          const cs = getComputedStyle(el);
          out.headings.push({ tag: h, font: cs.fontFamily, weight: cs.fontWeight, size: cs.fontSize, color: cs.color, transform: cs.textTransform, letterSpacing: cs.letterSpacing });
        }
      }

      // logo
      const img = document.querySelector('header img, .logo img, img[alt*="ogo"], img[src*="logo"]');
      if (img) out.logo = { src: img.src, alt: img.alt, w: img.naturalWidth, h: img.naturalHeight };

      // stylesheet links + google fonts
      out.fontLinks = Array.from(document.querySelectorAll('link[href*="font"], link[href*="Font"]')).map(l => l.href);
      return out;
    });

    report[url] = data;
  }

  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'brand-report.json'), JSON.stringify(report, null, 2));

  // print a digest
  for (const [url, d] of Object.entries(report)) {
    console.log('\n=== ' + url + ' ===');
    console.log('bodyFont:', d.bodyFont);
    console.log('bodyColor:', d.bodyColor, '->', rgbToHex(d.bodyColor));
    const top = (o, n = 12) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
    console.log('-- top text colors --');
    top(d.colorCount).forEach(([c, n]) => console.log(`  ${rgbToHex(c)}  (${c})  x${n}`));
    console.log('-- top backgrounds --');
    top(d.bgCount).forEach(([c, n]) => console.log(`  ${rgbToHex(c)}  (${c})  x${n}`));
    console.log('-- fonts --');
    top(d.fonts, 8).forEach(([f, n]) => console.log(`  ${f}  x${n}`));
    console.log('-- fontLinks --', d.fontLinks);
    console.log('-- headings --');
    (d.headings || []).forEach(h => console.log(`  ${h.tag}: ${h.font} ${h.weight} ${h.size} ${rgbToHex(h.color)} transform=${h.transform} ls=${h.letterSpacing}`));
    console.log('-- buttons (first 8) --');
    (d.buttons || []).slice(0, 8).forEach(b => console.log(`  "${b.text}" bg=${rgbToHex(b.bg)} color=${rgbToHex(b.color)} radius=${b.borderRadius} weight=${b.fontWeight} transform=${b.textTransform} pad=${b.padding} font=${b.font}`));
    console.log('-- logo --', d.logo);
  }
})();
