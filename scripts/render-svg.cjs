// Convertit assets/gecko-budget-icon.svg en PNG 1024 px (3 variantes) avec Chromium.
// Lancer : node scripts/render-svg.cjs   (puis python3 scripts/make-icons.py)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'assets/gecko-budget-icon.svg'), 'utf8');
const out = path.join(root, 'assets/rendered');
fs.mkdirSync(out, { recursive: true });

// Carré plein : on enlève les coins arrondis du fond (le téléphone arrondit lui-même)
const full = svg.replace(/rx="112"/g, 'rx="0"');
// Maskable : fond plein + dessin réduit à 80 % au centre (zone de sécurité)
const maskable = full.replace(/(<\/defs>\s*(?:<rect[^>]*\/>\s*){2})([\s\S]*)(<\/svg>)/, '$1<g transform="translate(256 256) scale(0.8) translate(-256 -256)">$2</g>$3');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  for (const [name, src] of [['icon', svg], ['full', full], ['maskable', maskable]]) {
    const sized = src.replace('width="512" height="512"', 'width="1024" height="1024"');
    await page.setContent(`<html><body style="margin:0;background:transparent">${sized}</body></html>`);
    await page.screenshot({ path: path.join(out, `${name}-1024.png`), omitBackground: true, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
  }
  await browser.close();
  console.log('PNG rendus dans assets/rendered');
})();
