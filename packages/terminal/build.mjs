// packages/terminal/build.mjs — assemble the single-file Terminal page.
//
// Upstream builds with `build_web.py` (Python + optional Pillow). This is the
// same job in Node so the master tool has one toolchain: inline the data, the
// engine, the app and the offline OCR engine into index_template.html, swap the
// PNG wordmark for an inline SVG (the SpicyTools wordmark ships as an image
// asset we do not vendor), and append the bridge that hands the itinerary to
// SpicyTools Link.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFile(join(SRC, name), 'utf8');

// Transparent-background wordmark, drawn inline so the built page is one file.
const WORDMARK = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="96" viewBox="0 0 640 96">
  <defs>
    <linearGradient id="s" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ff8a00"/>
      <stop offset="0.55" stop-color="#ff5c2b"/>
      <stop offset="1" stop-color="#e11d48"/>
    </linearGradient>
  </defs>
  <g fill="url(#s)" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="800">
    <text x="0" y="66" font-size="58">SpicyTools</text>
    <text x="392" y="66" font-size="58" fill="#f6efe9">Terminal</text>
  </g>
</svg>`;

const svgDataUri = 'data:image/svg+xml;base64,' + Buffer.from(WORDMARK).toString('base64');

const [template, data, engine, app, ocrad, bridge] = await Promise.all([
  read('index_template.html'),
  read('spicy_data.js'),
  read('spicy_engine.js'),
  read('app.js'),
  read('ocrad.js'),
  read('bridge.js')
]);

const html = template
  .replace('data:image/png;base64,__LOGO_MARK_B64__', svgDataUri)
  .replace('data:image/png;base64,__LOGO_FULL_B64__', svgDataUri)
  .replace('__OCRAD_JS__', () => ocrad)
  .replace('__SPICY_DATA__', () => data)
  .replace('__SPICY_ENGINE__', () => engine)
  .replace('__APP_JS__', () => `${app}\n${bridge}`);

await mkdir(join(SRC, 'public'), { recursive: true });
await writeFile(join(SRC, 'public', 'index.html'), html);

console.log(`built public/index.html (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
