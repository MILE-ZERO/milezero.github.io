// One-off: vendor fonts + hero images locally so the demo has ZERO external calls
// on demo day. Run: node vendor-assets.js
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const FONTS_DIR = path.join(ASSETS, 'fonts');
const IMG_DIR = path.join(ASSETS, 'img');
fs.mkdirSync(FONTS_DIR, { recursive: true });
fs.mkdirSync(IMG_DIR, { recursive: true });

// Modern UA so the CSS2 API serves woff2.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700' +
  '&family=Poppins:wght@300;400;500;600' +
  '&family=Zalando+Sans:wght@400;600;700;900&display=swap';

// Homepage hero (rights-safe stock kitchen, approximating the real Celebration hero).
// The Adriana page uses Celebration's own floorplan brochure images (vendored separately).
const HERO_IMAGES = [
  { url: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1600&q=70', file: 'hero-kitchen.jpg' },
];

async function getBuf(url, headers) {
  const r = await fetch(url, { headers: headers || {} });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
  return Buffer.from(await r.arrayBuffer());
}

async function vendorFonts() {
  const css = await (await fetch(FONT_CSS_URL, { headers: { 'User-Agent': UA } })).text();

  // Split into @font-face blocks, each preceded by a /* subset */ comment.
  const re = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]+)}/g;
  let m, out = [], count = 0;
  while ((m = re.exec(css))) {
    const subset = m[1];
    if (subset !== 'latin') continue; // English demo — latin subset only keeps it light
    const block = m[2];
    const family = (block.match(/font-family:\s*'([^']+)'/) || [])[1];
    const weight = (block.match(/font-weight:\s*(\d+)/) || [])[1];
    const style = (block.match(/font-style:\s*(\w+)/) || [])[1] || 'normal';
    const srcUrl = (block.match(/url\((https:\/\/[^)]+\.woff2)\)/) || [])[1];
    if (!srcUrl) continue;

    const slug = family.toLowerCase().replace(/\s+/g, '-') + '-' + weight + (style === 'italic' ? '-italic' : '');
    const fname = slug + '.woff2';
    const buf = await getBuf(srcUrl, { 'User-Agent': UA });
    fs.writeFileSync(path.join(FONTS_DIR, fname), buf);
    count++;

    out.push(
      '@font-face {\n' +
      `  font-family: '${family}';\n` +
      `  font-style: ${style};\n` +
      `  font-weight: ${weight};\n` +
      '  font-display: swap;\n' +
      `  src: url('fonts/${fname}') format('woff2');\n` +
      '}'
    );
    console.log('  font:', fname, (buf.length / 1024).toFixed(1) + 'kb');
  }

  const header =
    '/* Self-hosted Google Fonts (OFL) — vendored by tools/vendor-assets.js so the demo\n' +
    '   makes no external font calls. Latin subset only. Loaded via <link> in each page <head>. */\n\n';
  fs.writeFileSync(path.join(ASSETS, 'fonts.css'), header + out.join('\n\n') + '\n');
  console.log('wrote assets/fonts.css with', count, 'faces');
}

async function vendorImages() {
  for (const img of HERO_IMAGES) {
    const buf = await getBuf(img.url, { 'User-Agent': UA });
    fs.writeFileSync(path.join(IMG_DIR, img.file), buf);
    console.log('  image:', img.file, (buf.length / 1024).toFixed(1) + 'kb');
  }
}

(async () => {
  console.log('Vendoring fonts...');
  await vendorFonts();
  console.log('Vendoring hero images...');
  await vendorImages();
  console.log('Done.');
})().catch(e => { console.error(e); process.exit(1); });
