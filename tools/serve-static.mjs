// tools/serve-static.mjs — preview exactly what the static deploy ships.
//
// `npm run build && npm run serve` → http://localhost:4173 and you are looking at
// ./public, the same tree Vercel serves from vercel.json#outputDirectory. It is
// deliberately dumb: static files only, no API, so it also shows you which parts
// of the product need `npm run dev` (the app in apps/web) instead.
//
// Anything under /api/ or /mcp answers 501 on purpose rather than pretending.

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(resolve(fileURLToPath(import.meta.url), '../..'), 'public');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8'
};

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  if (pathname.startsWith('/api/') || pathname === '/mcp' || pathname === '/health') {
    res.writeHead(501, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'static preview only — run `npm run dev` for the API' }));
  }

  let file = resolve(ROOT, '.' + pathname);
  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) {
    file = join(file, 'index.html');
    info = await stat(file).catch(() => null);
  }
  if (!info?.isFile() || !file.startsWith(resolve(ROOT))) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('404 — not in ./public (that part of SpicyTools is served by `npm run dev`).\n');
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(file)] || 'application/octet-stream',
    'content-length': info.size,
    'cache-control': 'no-store'
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`SpicyTools static preview → http://localhost:${PORT}  (serving ${ROOT})`);
});
