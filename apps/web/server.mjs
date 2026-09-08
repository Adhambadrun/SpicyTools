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
//   /health           service health
//
// Plain Node, no framework: the MCP handler expects the Vercel req/res contract
// (res.status().json(), req.body pre-parsed), so we shim those two helpers and
// mount api/mcp.js exactly as the serverless deployment does.

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import mcpHandler from '../../packages/mcp/api/mcp.js';
import { registerTools, rateDeal } from '../../packages/mcp/lib/tools.js';
import { loadDataset, entries, metaOf } from '../../packages/mcp/lib/dataset.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = resolve(HERE, 'public');
const WIDGET_DIR = resolve(HERE, '../../packages/widget/dist');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

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

      return sendJson(res, 200, {
        count: deals.length,
        disclaimer: metaOf(loadDataset('hot-deals', 'own')).disclaimer,
        deals,
      });
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
  console.log(`      Datasets       /api/datasets\n`);
});
