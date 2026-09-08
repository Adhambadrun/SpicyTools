// apps/web/server.mjs — the SpicyQuote master app.
//
// One process, one port, everything the product needs:
//
//   /                 SpicyQuote site (search widget + spice board)
//   /widget/*         the built widget bundle (packages/widget/dist)
//   /api/deals        the deal feed, rated (same heat model as the widget + MCP)
//   /api/tools        metadata for every MCP tool, read straight from the registry
//   /api/datasets     travel-hacking dataset sizes and freshness
//   /mcp              the SpicyQuote MCP endpoint (mounted in-process)
//   /api/v1/health    SpicyTool-compatible API surface
//   /api/v1/airports  airport typeahead (SpicyTool shape)
//   /api/v2/search    award search (SpicyTool shape)
//   /health           service health
//
// Plain Node, no framework: the MCP handler expects the Vercel req/res contract
// (res.status().json(), req.body pre-parsed), so we shim those two helpers and
// mount api/mcp.js exactly as the serverless deployment does.

import http from 'node:http';
import https from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import mcpHandler from '../../packages/mcp/api/mcp.js';
import { registerTools, rateDeal } from '../../packages/mcp/lib/tools.js';
import { loadDataset, entries, metaOf } from '../../packages/mcp/lib/dataset.js';
import { createRequire } from 'node:module';

// The BCF widget's link builders — reused here so a SpicyQuote deal opens in
// the same places an agent's BCF lead does.
const require = createRequire(import.meta.url);
const flightLinks = require('../../packages/bcf-widget/src/flight-links.js');

const HERE = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = resolve(HERE, 'public');
const WIDGET_DIR = resolve(HERE, '../../packages/widget/dist');
const AIRPORTS_FILE = resolve(HERE, '../../packages/spicytool/backend/data/airports.json');
const BCF_DIR = resolve(HERE, '../../packages/bcf-widget/dist');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

// Base URL of a SpicyTool API (`https://search.example.com`). When it is set,
// /api/v1/* and /api/v2/* are proxied to it; when it is not, those endpoints
// are answered from the local dataset so the demo still runs standalone.
const SPICYTOOL_API_BASE = (process.env.SPICYTOOL_API_BASE || '').replace(/\/$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

const DATASETS = [
  'sweet-spots',
  'transfer-partners',
  'points-valuations',
  'award-holds',
  'stopovers',
  'status-match',
  'rtw-awards',
  'alliances',
  'partner-awards',
];

function allDeals() {
  return entries(loadDataset('hot-deals', 'own'))
    .map(([id, deal]) => rateDeal({ id, ...deal }))
    .sort((a, b) => b.discountPercent - a.discountPercent || a.price - b.price);
}

// ---------------------------------------------------------------------------
// SpicyTool-compatible API
//
// The widget speaks the SpicyTool contract (see packages/spicytool/backend):
// flat airport records, a priced calendar and a /api/v2/search endpoint. This
// server implements that contract locally so the site works with no Python
// backend, and proxies to a real SpicyTool instance when one is configured.
// ---------------------------------------------------------------------------

let AIRPORTS = [];

try {
  const raw = JSON.parse(readFileSync(AIRPORTS_FILE, 'utf8'));

  // SpicyTool stores airports as { CODE: {...} }; /api/v1/airports serves them
  // as flat records carrying their own code.
  AIRPORTS = Object.keys(raw).map((code) => ({ code, ...raw[code] }));
} catch (err) {
  console.warn(`[spicyquote] could not read ${AIRPORTS_FILE}: ${err.message}`);
}

const airportScore = (airport, needle) => {
  let best = -1;

  for (const field of [airport.code, airport.city, airport.name, airport.country]) {
    if (typeof field !== 'string') continue;

    const value = field.toLowerCase();

    if (value === needle) best = Math.max(best, 1000 - value.length);
    else if (value.startsWith(needle)) best = Math.max(best, 500 - value.length);
    else if (value.includes(needle)) best = Math.max(best, 250 - value.indexOf(needle));
  }

  return best;
};

const searchAirportsLocally = (query, limit = 10) => {
  const needle = String(query || '').trim().toLowerCase();

  if (!needle) return [];

  return AIRPORTS
    .map((airport) => ({ airport, score: airportScore(airport, needle) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score || a.airport.code.localeCompare(b.airport.code))
    .slice(0, limit)
    .map(({ airport }) => airport);
};

/** GET a JSON path from the configured SpicyTool API, or `null` on any failure. */
const proxySpicyTool = (apiPath) =>
  new Promise((resolve) => {
    if (!SPICYTOOL_API_BASE) return resolve(null);

    let url;

    try {
      url = new URL(apiPath, `${SPICYTOOL_API_BASE}/`);
    } catch {
      return resolve(null);
    }

    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.get(url, (upstream) => {
      let raw = '';

      upstream.setEncoding('utf8');
      upstream.on('data', (chunk) => (raw += chunk));
      upstream.on('end', () => {
        if (upstream.statusCode !== 200) return resolve(null);

        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(null);
        }
      });
    });

    request.on('error', () => resolve(null));
    request.setTimeout(5000, () => {
      request.destroy();
      resolve(null);
    });
  });

/**
 * Turn a SpicyQuote deal into the lead shape the BCF builders expect.
 */
function leadFromDeal(deal) {
  return {
    id: deal.id,
    name: deal.label || null,
    origin: deal.departure,
    destination: deal.arrival,
    cabin: deal.cabin || 'Y',
    departureDate: deal.departDate,
    returnDate: deal.returnDate || null,
    adults: deal.adults || 1,
    children: 0,
    infants: 0
  };
}

/**
 * Everywhere an agent can take a fare: the same links the BCF floating widget
 * shows for a lead on bo.bcflights.com.
 */
function dealLinks(deal) {
  const lead = leadFromDeal(deal);
  const leg = { origin: lead.origin, destination: lead.destination, date: lead.departureDate };

  return {
    kayak: flightLinks.buildKayakUrl(lead, 0),
    google: flightLinks.buildGoogleFlightsUrl(lead, false),
    googleElr: flightLinks.buildGoogleFlightsUrl(lead, true),
    matrix: flightLinks.buildMatrixUrl(lead, null, null, null, 0),
    pointsYeah: flightLinks.buildPointsYeahUrl(lead, leg, 0),
    spicyQuote: flightLinks.buildSpicyQuoteUrl(lead, leg),
    fastSearch: flightLinks.buildFastSearchCommand(lead)
  };
}

/** Answer `path` from the local dataset, or `null` if this server cannot. */
const answerSpicyToolLocally = (pathname, params) => {
  // GET /api/v1/airports?q=MOW&limit=10
  if (pathname === '/api/v1/airports') {
    const limit = Math.min(Number(params.get('limit')) || 10, 50);

    return searchAirportsLocally(params.get('q') || params.get('query') || '', limit);
  }

  // GET /api/v1/programs — the loyalty programs named in the deal feed.
  if (pathname === '/api/v1/programs') {
    const programs = new Set(
      allDeals()
        .map((deal) => deal.program)
        .filter(Boolean)
    );

    return { programs: [...programs].sort() };
  }

  // GET /api/v2/providers — no live providers without an upstream API.
  if (pathname === '/api/v2/providers') {
    return [];
  }

  return null;
};

// Collect the MCP tool registry without standing up a transport: registerTools()
// only needs an object with registerTool(), so we hand it a recorder.
const TOOLS = (() => {
  const collected = [];
  registerTools({ registerTool: (name, config) => collected.push({ name, ...config }) });

  return collected.map(({ name, title, description, annotations }) => ({
    name,
    title: title || name,
    description,
    local: annotations ? annotations.openWorldHint !== true : true,
  }));
})();

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function sendFile(res, filePath) {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('not a file');

    const body = await readFile(filePath);
    res.writeHead(200, {
      'content-type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

/** Resolve a URL path to a file inside `root`, refusing to escape it. */
function safeJoin(root, urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const target = resolve(join(root, normalize(clean)));

  if (target !== root && !target.startsWith(root + sep)) {
    return null;
  }

  return target;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// Vercel-compatible helpers the MCP handler relies on.
function withVercelHelpers(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => sendJson(res, res.statusCode || 200, obj);
  return res;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  try {
    // --- MCP (POST only; stateless streamable-HTTP) ---
    if (pathname === '/mcp' || pathname === '/api/mcp') {
      withVercelHelpers(res);

      if (req.method === 'POST') {
        const raw = await readBody(req);
        try {
          req.body = raw ? JSON.parse(raw) : undefined;
        } catch {
          return sendJson(res, 400, { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null });
        }
      }

      return await mcpHandler(req, res);
    }

    // --- Health ---
    if (pathname === '/health' || pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        service: 'spicyquote',
        tools: TOOLS.length,
        dealsInFeed: allDeals().length,
      });
    }

    // --- API ---
    if (pathname === '/api/deals') {
      const from = (url.searchParams.get('from') || '').toUpperCase();
      const minHeat = url.searchParams.get('minHeat');
      const order = ['mild', 'medium', 'hot', 'inferno'];

      const deals = allDeals()
        .filter((deal) => !from || deal.departure === from)
        .filter((deal) => !minHeat || order.indexOf(deal.heat) >= order.indexOf(minHeat));

      const withLinks = url.searchParams.get('links') === '1';

      return sendJson(res, 200, {
        count: deals.length,
        disclaimer: metaOf(loadDataset('hot-deals', 'own')).disclaimer,
        deals: withLinks ? deals.map((deal) => ({ ...deal, links: dealLinks(deal) })) : deals,
      });
    }

    // --- SpicyTool-compatible API ---
    if (pathname.startsWith('/api/v1/') || pathname.startsWith('/api/v2/')) {
      const apiPath = pathname + (url.search || '');

      if (pathname === '/api/v1/health') {
        return sendJson(res, 200, {
          status: 'ok',
          service: 'spicyquote',
          upstream: SPICYTOOL_API_BASE || null,
          airports: AIRPORTS.length,
          deals: allDeals().length,
        });
      }

      const upstream = await proxySpicyTool(apiPath);

      if (upstream !== null) {
        return sendJson(res, 200, upstream);
      }

      const local = answerSpicyToolLocally(pathname, url.searchParams);

      if (local !== null) {
        return sendJson(res, 200, local);
      }

      return sendJson(res, 502, {
        error: 'no_upstream',
        message: SPICYTOOL_API_BASE
          ? 'SpicyTool API did not answer this request.'
          : 'Set SPICYTOOL_API_BASE to a SpicyTool API to serve this endpoint.',
        path: pathname,
      });
    }

    // GET /api/deals/:id/links — external search links for one deal.
    if (/^\/api\/deals\/[^/]+\/links$/.test(pathname)) {
      const id = decodeURIComponent(pathname.split('/')[3]);
      const deal = allDeals().find((item) => item.id === id);

      if (!deal) {
        return sendJson(res, 404, { error: 'not_found', id });
      }

      return sendJson(res, 200, { id, links: dealLinks(deal) });
    }

    // --- BCF widget: the userscript, so a host can point an installer at it ---
    if (pathname === '/bcf-widget.user.js') {
      const bundle = join(BCF_DIR, 'bcf-floating-flight-search-widget.user.js');

      if (!existsSync(bundle)) {
        return sendJson(res, 404, {
          error: 'not_built',
          message: 'Run `npm run build --workspace @spicyquote/bcf-widget` first.'
        });
      }

      return sendFile(res, bundle);
    }

    if (pathname === '/api/tools') {
      return sendJson(res, 200, { count: TOOLS.length, tools: TOOLS });
    }

    if (pathname === '/api/datasets') {
      // Datasets are grouped (e.g. sweet-spots → flights / hotels), so report
      // both the sections and the record count inside them.
      const countRecords = (value) =>
        Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : 0;

      const datasets = DATASETS.map((name) => {
        const data = loadDataset(name);
        const sections = entries(data).map(([key, value]) => ({ key, records: countRecords(value) }));

        return {
          name,
          sections: sections.map((section) => section.key),
          records: sections.reduce((sum, section) => sum + section.records, 0),
          lastUpdated: metaOf(data).last_updated || null,
        };
      });

      return sendJson(res, 200, { count: datasets.length, datasets });
    }

    // --- Built widget bundle ---
    if (pathname.startsWith('/widget/')) {
      const target = safeJoin(WIDGET_DIR, pathname.replace(/^\/widget/, ''));
      return target ? sendFile(res, target) : sendJson(res, 403, { error: 'forbidden' });
    }

    // --- Static site ---
    if (pathname === '/' || extname(pathname) === '') {
      return sendFile(res, join(PUBLIC_DIR, 'index.html'));
    }

    const target = safeJoin(PUBLIC_DIR, pathname);
    return target ? sendFile(res, target) : sendJson(res, 403, { error: 'forbidden' });
  } catch (err) {
    console.error('[spicyquote] error:', err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'internal', message: String(err.message || err) });
    }
  }
});

// The widget bundle is build output (git-ignored), so a fresh clone has none yet.
if (!existsSync(join(WIDGET_DIR, 'spicyquote.min.js'))) {
  console.warn('  ⚠  No widget bundle in packages/widget/dist — run `npm run build` to generate it.');
}

server.listen(PORT, HOST, () => {
  console.log(`\n  🌶  SpicyQuote running at http://localhost:${PORT}`);
  console.log(`      MCP endpoint   /mcp            (${TOOLS.length} tools)`);
  console.log(`      Deal feed      /api/deals`);
  console.log(`      Tool registry  /api/tools`);
  console.log(`      Datasets       /api/datasets`);
  console.log(`      SpicyTool API  /api/v1/airports, /api/v2/search`);
  console.log(`                     upstream: ${SPICYTOOL_API_BASE || '(local dataset only)'}\n`);
});
