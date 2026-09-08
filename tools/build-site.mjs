// tools/build-site.mjs — assemble the deployable static site into ./public.
//
// WHY THIS EXISTS
// Vercel builds the *repo root* (`npm run build`) and then serves the project's
// Output Directory — for a root deploy that is `public` (the "Other" framework
// preset falls back to `public` if it exists). The workspace builds emit inside
// their own packages (`packages/terminal/public`, `packages/widget/dist`,
// `packages/bcf-widget/dist`), so the root deploy died with:
//
//   Error: No Output Directory named "public" found after the Build completed.
//
// This step gathers them into one root `public/` (declared by the root
// vercel.json#outputDirectory), so a single repo-root Vercel project ships:
//
//   public/index.html                      the SpicyTools front door
//   public/terminal/index.html             the single-file Terminal page
//   public/widget/spicytools.min.{js,css}  the embeddable widget bundle
//   public/bcf-widget.user.js              the BCF floating userscript
//   public/favicon.svg                     mark (the repo's 1.1 MB logo.png is
//                                          served at /logo.png, unchanged, for
//                                          anyone who wants the raster)
//
// It only copies — the workspace builds stay the source of truth, so this runs
// *after* them and never rebuilds anything.
//
//   npm run site   # just this step (assumes the workspace builds already ran)
//   npm run build  # widget + bcf-widget + terminal + this

import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public');

const WIDGET_DIST = join(ROOT, 'packages/widget/dist');
const BCF_DIST = join(ROOT, 'packages/bcf-widget/dist');
const TERMINAL_OUT = join(ROOT, 'packages/terminal/public');

/** Files webpack emits for the widget that a host page needs next to the JS. */
const WIDGET_FILES = ['spicytools.min.js', 'spicytools.min.js.LICENSE.txt', 'spicytools.min.css', 'cr.svg', 'ow.svg'];

const log = (...args) => console.log('[site]', ...args);
const human = (bytes) => (bytes > 1024 * 1000 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.round(bytes / 1024)} KiB`);

/**
 * Copy one build artifact into the deploy tree if it exists, and report what
 * landed. Named `place` (not `copyFile`) so it cannot shadow fs/promises.
 */
async function place(src, dest, label) {
  if (!existsSync(src)) return null;
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(src, dest);
  return { label, bytes: (await stat(dest)).size };
}

// An inline SVG wordmark keeps the deploy light and self-contained: the repo's
// logo.png is a 1.1 MB 1254×1254 raster and a static front door should not pay
// for it. Same gradient the Terminal page draws in build.mjs.
const BRAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="56" viewBox="0 0 420 56" role="img" aria-label="SpicyTools">
  <defs>
    <linearGradient id="flame" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ff8a00"/><stop offset="0.55" stop-color="#ff5c2b"/><stop offset="1" stop-color="#e11d48"/>
    </linearGradient>
  </defs>
  <g fill="url(#flame)" font-family="Inter, system-ui, 'Segoe UI', Helvetica, Arial, sans-serif" font-weight="800">
    <text x="0" y="41" font-size="36">SpicyTools</text>
  </g>
</svg>`;

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff8a00"/><stop offset="0.55" stop-color="#ff5c2b"/><stop offset="1" stop-color="#e11d48"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="#07070b"/>
  <path d="M42 17c0 12-9 16-16 20-6 3.4-9 8-9 8s2-9 8-13c5-3.4 10-5 12-9 1.6-3.2 5-6 5-6z" fill="url(#f)"/>
  <path d="M40 16c2-3 6-4 9-3-1 4-5 6-8 6z" fill="#53d977"/>
</svg>`;

const LANDING = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>SpicyTools — fares with a kick</title>
<meta name="description" content="SpicyTools rates every fare on a four-chilli heat scale: an embeddable search widget, a GDS itinerary Terminal, booking-link generation and an MCP server for AI agents.">
<meta property="og:title" content="SpicyTools — fares with a kick">
<meta property="og:description" content="One master tool for hot fares: search widget, GDS Terminal, booking links, MCP server for agents.">
<meta property="og:type" content="website">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
:root{
  --bg:#07070b;--pane:#0d1017;--line:#1b2130;--ink:#f2f3f7;--dim:#a9afc2;--muted:#6f7891;
  --amber:#ff9f1c;--rose:#e11d48;--green:#53d977;
  --flame:linear-gradient(90deg,#ff8a00,#ff5c2b 55%,#e11d48);
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,"Cascadia Mono","JetBrains Mono",Consolas,Menlo,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.55;
  background-image:radial-gradient(900px 420px at 15% -10%,rgba(255,59,31,.18),rgba(255,59,31,0) 60%),
                   radial-gradient(700px 380px at 95% 0%,rgba(255,159,28,.12),rgba(255,159,28,0) 60%)}
a{color:var(--amber);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:1080px;margin:0 auto;padding:clamp(28px,5vw,64px) clamp(16px,4vw,32px) 72px}
.brand{display:flex;align-items:center;gap:14px;margin-bottom:10px}
.brand svg{height:44px;width:auto;display:block}
h1{margin:0;font-size:clamp(30px,6vw,50px);letter-spacing:-.02em;line-height:1.05;
  background:var(--flame);-webkit-background-clip:text;background-clip:text;color:transparent}
.tagline{color:var(--dim);font-size:clamp(15px,2.4vw,19px);max-width:64ch;margin:10px 0 4px}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 32px}
.badge{font-family:var(--mono);font-size:12px;padding:6px 10px;border:1px solid var(--line);border-radius:999px;color:var(--dim);background:#0b0d13}
.badge b{color:var(--ink);font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:8px}
.card{background:var(--pane);border:1px solid var(--line);border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:9px}
.card h2{margin:0;font-size:17px;letter-spacing:-.01em}
.kicker{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.card p{margin:0;color:var(--dim);font-size:14px;flex:1 1 auto}
.go{margin-top:4px;font-family:var(--mono);font-size:13px}
.go::after{content:" \\2192"}
.pill{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:11px;padding:3px 8px;
  border-radius:999px;border:1px solid var(--line);color:var(--muted);width:max-content}
.pill.live{color:var(--green);border-color:#1c3a28}
.pill.serve{color:var(--amber);border-color:#3a2c12}
section{margin:32px 0}
section>h3{margin:0 0 12px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-family:var(--mono)}
#rack{border:1px solid var(--line);border-radius:14px;background:var(--pane);padding:18px;overflow:hidden}
#rack .note{color:var(--muted);font-size:13px;margin:12px 0 0}
#rack .err{display:none;color:var(--rose);font-size:14px;margin:0}
#rack.broken .err{display:block}
#rack.broken #spicytools-root{display:none}
pre{margin:0;padding:14px 16px;background:#0b0d13;border:1px solid var(--line);border-radius:12px;overflow:auto;
  font-family:var(--mono);font-size:12.5px;line-height:1.6;color:#dbe4f5}
code.inline{font-family:var(--mono);font-size:.92em;background:#0b0d13;border:1px solid var(--line);border-radius:5px;padding:1px 5px;color:#ffd9a8}
.split{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
footer{margin-top:40px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:13px;
  display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between}
</style>
</head>
<body>
<div class="wrap">

<div class="brand">__BRAND_SVG__</div>
<p class="tagline">Flight search tells you the price. SpicyTools tells you whether the price is
<em>good</em> — every fare gets a four-chilli heat rating, in one embeddable widget, a GDS
itinerary Terminal, a booking-link generator and an MCP server your agents can call.</p>
<div class="badges">
  <span class="badge"><b>&lt; 20%</b> mild 🌶</span>
  <span class="badge"><b>20–34%</b> medium 🌶🌶</span>
  <span class="badge"><b>35–49%</b> hot 🌶🌶🌶</span>
  <span class="badge"><b>50%+</b> inferno 🌶🌶🌶🌶</span>
</div>

<div class="grid">
  <div class="card">
    <span class="kicker">Search</span>
    <h2>Spicy Search widget</h2>
    <p>Search form with the spice rack built in: React/TypeScript, two files and one
    <code class="inline">SpicyTools.init()</code> call, embeds anywhere.</p>
    <span class="pill live">live demo below</span>
    <a class="go" href="/widget/spicytools.min.js">grab the bundle</a>
  </div>
  <div class="card">
    <span class="kicker">Itinerary</span>
    <h2>SpicyTools Terminal</h2>
    <p>Paste flights from Google Flights, an airline page, an email or a screenshot and get a GDS
    black-window itinerary. Deterministic, 100% offline, one HTML file.</p>
    <span class="pill live">static — works here</span>
    <a class="go" href="/terminal/">open the Terminal</a>
  </div>
  <div class="card">
    <span class="kicker">Booking</span>
    <h2>SpicyTools Link</h2>
    <p>A GDS itinerary → AA / United / Delta / BA / Alaska / Google Flights / ITA Matrix links,
    BookWithMatrix JSON and a fare estimate. Two-factor gated to <code class="inline">@bcflights.com</code>.</p>
    <span class="pill serve">served by the Node app</span>
    <a class="go" href="https://github.com/Adhambadrun/SpicyTools#terminal--link">read about it</a>
  </div>
  <div class="card">
    <span class="kicker">Agents</span>
    <h2>MCP server</h2>
    <p>15 read-only tools: <code class="inline">spice_meter</code>, <code class="inline">find_hot_deals</code>,
    <code class="inline">gds_itinerary</code>, nine travel-hacking datasets and three web-research tools.</p>
    <span class="pill serve">served by the Node app</span>
    <a class="go" href="https://github.com/Adhambadrun/SpicyTools#connect-an-agent">connect an agent</a>
  </div>
  <div class="card">
    <span class="kicker">Desk</span>
    <h2>BCF floating widget</h2>
    <p>Tampermonkey userscript for <code class="inline">bo.bcflights.com</code>: detect the lead, open it in
    Kayak, Google Flights, ITA Matrix, PointsYeah or SpicyTools, copy the Sabre Fast Search command.</p>
    <span class="pill live">installable here</span>
    <a class="go" href="/bcf-widget.user.js">view / install</a>
  </div>
  <div class="card">
    <span class="kicker">Knowledge</span>
    <h2>Travel-hacking toolkit</h2>
    <p>Sweet spots, transfer partners, points valuations, award holds, stopovers, status matches,
    RTW awards — the dataset the rest of SpicyTools reads from.</p>
    <span class="pill live">ships with the repo</span>
    <a class="go" href="https://github.com/Adhambadrun/SpicyTools/tree/main/packages/toolkit">open the data</a>
  </div>
</div>

<section>
  <h3>The widget, running from this page</h3>
  <div id="rack">
    <div id="spicytools-root"></div>
    <p class="err">The widget bundle did not load on this host — use the snippet below on your own page.</p>
    <p class="note">Sample fares are illustrative, not live quotes. Point <code class="inline">apiBase</code>
    at a SpicyTool-compatible API (<code class="inline">/api/v1/airports</code>,
    <code class="inline">/api/v1/calendar</code>, <code class="inline">/api/v2/search</code>) for priced
    calendars and award search; without one the rack and the deep links still work.</p>
  </div>
</section>

<section>
  <h3>Embed it</h3>
  <pre>&lt;div id="spicytools"&gt;&lt;/div&gt;
&lt;link rel="stylesheet" href="https://YOUR-HOST/widget/spicytools.min.css"&gt;
&lt;script src="https://YOUR-HOST/widget/spicytools.min.js"&gt;&lt;/script&gt;
&lt;script&gt;
  SpicyTools.init({
    rootElement: document.getElementById('spicytools'),
    apiBase: 'https://your-fare-api.example.com',
    locale: 'en',
    hotDeals: [
      { departure: 'CAI', arrival: 'IST', price: 118, baselinePrice: 240, currency: 'USD',
        departDate: '2026-10-09', returnDate: '2026-10-16', label: 'Bosphorus weekend' }
    ],
    onSearch: (info) =&gt; console.log(info)
  });
&lt;/script&gt;</pre>
</section>

<section>
  <h3>Self-hosted: site + API + /mcp in one process</h3>
  <div class="split">
    <pre>git clone https://github.com/Adhambadrun/SpicyTools
cd SpicyTools
npm install
npm run build
npm run dev     # → http://localhost:3000</pre>
    <pre>/                    site + widget + spice board
/terminal             GDS itinerary page
/link                 booking links (2FA)
/api/deals            the rated deal feed
/api/tools            MCP tool registry
/mcp                  streamable-HTTP MCP endpoint
/bcf-widget.user.js   the userscript</pre>
  </div>
  <p class="tagline" style="font-size:14px">This static deploy ships the parts that need no server:
  the Terminal is a single self-contained HTML file, the widget bundle and the userscript are plain
  assets. The deal feed, the SpicyTool search API and <code class="inline">/mcp</code> live in
  <code class="inline">apps/web/server.mjs</code> — run that (or mount its handlers as Vercel
  Functions under a root <code class="inline">api/</code> directory) to serve them.</p>
</section>

<footer>
  <span>Fares with a kick · MIT licence · <a href="https://github.com/Adhambadrun/SpicyTools">SpicyTools on GitHub</a></span>
  <span>Never invents a bargain: no reference price → <code class="inline">mild</code> at 0% off.</span>
</footer>

</div>

<link rel="stylesheet" href="/widget/spicytools.min.css">
<script src="/widget/spicytools.min.js"></script>
<script>
(function () {
  var root = document.getElementById('spicytools-root');
  function fail() { document.getElementById('rack').classList.add('broken'); }
  if (!root || typeof SpicyTools === 'undefined' || !SpicyTools.init) { fail(); return; }
  try {
    SpicyTools.init({
      rootElement: root,
      // Same origin: on this static host the fare API is absent, so typeahead and the
      // priced calendar fail quietly and only the rack + deep-link building are exercised.
      apiBase: location.origin,
      locale: 'en',
      mode: 'SPICY',
      useNearestAirport: true,
      hotDeals: [
        { departure: 'CAI', arrival: 'IST', price: 118, baselinePrice: 240, currency: 'USD',
          departDate: '2026-10-09', returnDate: '2026-10-16', label: 'Bosphorus weekend', directFlight: true },
        { departure: 'CAI', arrival: 'LIS', price: 232, baselinePrice: 610, currency: 'USD',
          departDate: '2026-11-04', returnDate: '2026-11-11', label: 'Atlantic run' },
        { departure: 'DXB', arrival: 'TBS', price: 141, baselinePrice: 195, currency: 'USD',
          departDate: '2026-10-22', label: 'Caucasus one-way' },
        { departure: 'BER', arrival: 'OTP', price: 62, baselinePrice: 210, currency: 'EUR',
          departDate: '2026-09-26', returnDate: '2026-10-03', label: 'Romanian weekend' },
        { departure: 'JFK', arrival: 'LIS', price: 389, baselinePrice: 700, currency: 'USD',
          departDate: '2026-11-10', returnDate: '2026-11-20', label: 'Transatlantic steal' }
      ]
    });
  } catch (err) {
    fail();
  }
})();
</script>
</body>
</html>
`;

/* ---------------------------------------------------------------------- run */

await mkdir(OUT, { recursive: true });
const written = [];
const record = (r) => r && written.push(`${r.label} (${human(r.bytes)})`);

// 1. Terminal — the single-file page, served at /terminal/ by a static host.
record(await place(join(TERMINAL_OUT, 'index.html'), join(OUT, 'terminal', 'index.html'), 'terminal/index.html'));
if (!written.length) {
  throw new Error(
    '[site] packages/terminal/public/index.html is missing — run `npm run build --workspace @spicytools/terminal` first (it is part of `npm run build`).'
  );
}

// 2. Widget bundle. The two SVGs are referenced as absolute paths (webpack
//    publicPath '/'), so they go to the deploy root as well as /widget.
for (const name of WIDGET_FILES) {
  record(await place(join(WIDGET_DIST, name), join(OUT, 'widget', name), `widget/${name}`));
  if (name.endsWith('.svg')) record(await place(join(WIDGET_DIST, name), join(OUT, name), name));
}
// No directory listing at /widget/.
await writeFile(join(OUT, 'widget', 'index.html'), '<meta http-equiv="refresh" content="0; url=/">\n');
written.push('widget/index.html');

// 3. The BCF userscript, at the same URL the local app serves it on.
record(await place(join(BCF_DIST, 'bcf-floating-flight-search-widget.user.js'), join(OUT, 'bcf-widget.user.js'), 'bcf-widget.user.js'));

// 4. The repo wordmark, at its repo path, for pages that want the raster.
record(await place(join(ROOT, 'logo.png'), join(OUT, 'logo.png'), 'logo.png'));

// 5. Brand mark + favicon (SVG, so the deploy never drags a 1.1 MB PNG along).
await writeFile(join(OUT, 'favicon.svg'), FAVICON_SVG);
written.push('favicon.svg');

// 6. The front door.
const landing = LANDING.replace('__BRAND_SVG__', BRAND_SVG);
await writeFile(join(OUT, 'index.html'), landing);
written.push(`index.html (${human(landing.length)})`);

log(`${OUT.replace(ROOT + '/', '')}/ → ${written.join(', ')}`);
