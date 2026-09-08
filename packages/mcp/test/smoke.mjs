// test/smoke.mjs — real end-to-end smoke test against a locally-running
// local-server.js (which serves the exact same api/mcp.js Vercel handler).
// No mocks: initialize, tools/list and tools/call all go over real HTTP/JSON-RPC
// to a real MCP server instance.
//
// Usage:
//   node local-server.js &            # in one terminal
//   node test/smoke.mjs               # in another
//
// Two classes of tool are exercised:
//   * Local tools (spice_meter, find_hot_deals, and the travel-hacking dataset
//     tools) need nothing but the bundled JSON, so they are asserted hard.
//   * The web-research trio proxies the metered AgentSearch API behind a
//     RapidAPI proxy-secret guard. Without SPICYTOOLS_MCP_PROXY_SECRET the
//     origin answers 403, which is an expected upstream-auth condition rather
//     than a wiring bug, so that call only warns.

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3900';

let idCounter = 1;

async function rpc(method, params) {
  const body = { jsonrpc: '2.0', id: idCounter++, method, params };
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  // StreamableHTTPServerTransport may respond with either a JSON body or an
  // SSE stream ("event: message\ndata: {...}\n\n") depending on client Accept
  // headers / SDK version. Handle both.
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream') || text.includes('\ndata:') || text.startsWith('data:')) {
    const dataLine = text.split('\n').find((l) => l.startsWith('data:'));
    if (!dataLine) throw new Error(`no SSE data line in response: ${text}`);
    return { status: res.status, json: JSON.parse(dataLine.slice(5).trim()) };
  }
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function callTool(name, args) {
  const res = await rpc('tools/call', { name, arguments: args });
  const text = res.json?.result?.content?.[0]?.text;

  if (res.json?.result?.isError) {
    throw new Error(`tools/call ${name} returned isError: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log(`Smoke-testing SpicyTools MCP at ${BASE} ...\n`);

  // 1. health
  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  console.log('== GET /health ==');
  console.log(JSON.stringify(health, null, 2));
  if (!health.ok) throw new Error('health check failed');
  if (health.service !== 'spicytools-mcp') throw new Error(`unexpected service: ${health.service}`);

  // 2. initialize
  const init = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'spicytools-mcp-smoke-test', version: '1.0.0' },
  });
  console.log('\n== initialize ==');
  console.log(`HTTP ${init.status}`);
  const serverName = init.json?.result?.serverInfo?.name;
  console.log(`server: ${serverName}`);
  if (init.status !== 200 || init.json?.error) throw new Error('initialize failed');
  if (serverName !== 'spicytools') throw new Error(`unexpected server name: ${serverName}`);

  // 3. tools/list
  const list = await rpc('tools/list', {});
  console.log('\n== tools/list ==');
  const tools = list.json?.result?.tools || [];
  console.log(`HTTP ${list.status}, ${tools.length} tools:`);
  for (const t of tools) {
    console.log(`  - ${t.name}`);
  }
  if (tools.length < 10) throw new Error(`expected >= 10 tools, got ${tools.length}`);
  for (const required of ['spice_meter', 'find_hot_deals', 'award_sweet_spots', 'transfer_partners', 'web_search']) {
    if (!tools.some((t) => t.name === required)) throw new Error(`missing tool: ${required}`);
  }

  // 4. spice_meter — pure arithmetic, no network
  const rated = await callTool('spice_meter', { price: 150, baselinePrice: 240, currency: 'USD' });
  console.log('\n== tools/call spice_meter {price:150, baselinePrice:240} ==');
  console.log(JSON.stringify(rated, null, 2));
  if (rated.heat !== 'hot') throw new Error(`expected heat "hot", got "${rated.heat}"`);
  if (rated.discountPercent !== 38) throw new Error(`expected 38% off, got ${rated.discountPercent}`);

  // 4b. the top of the scale, and the no-baseline case (no invented heat)
  const inferno = await callTool('spice_meter', { price: 118, baselinePrice: 240 });
  if (inferno.heat !== 'inferno' || inferno.peppers !== 4) throw new Error(`expected inferno/4 peppers, got ${inferno.heat}/${inferno.peppers}`);
  const mild = await callTool('spice_meter', { price: 199 });
  if (mild.heat !== 'mild' || mild.discountPercent !== 0) throw new Error('a fare with no baseline must be rated mild at 0% off');

  // 5. find_hot_deals — bundled deal feed
  const deals = await callTool('find_hot_deals', { minHeat: 'medium', limit: 5 });
  console.log('\n== tools/call find_hot_deals {minHeat:"medium", limit:5} ==');
  console.log(`${deals.count} deals, hottest: ${deals.deals[0]?.departure}-${deals.deals[0]?.arrival} (${deals.deals[0]?.heat})`);
  if (!deals.count) throw new Error('deal feed returned nothing');
  if (!deals.disclaimer) throw new Error('deal feed response is missing its sample-data disclaimer');

  // 6. a dataset tool — proves the toolkit JSON is reachable from the server
  const partners = await callTool('transfer_partners', { card: 'chase', limit: 3 });
  console.log('\n== tools/call transfer_partners {card:"chase"} ==');
  console.log(`${partners.count} entries — first: ${Object.keys(partners.results)[0]}`);
  if (!partners.count) throw new Error('transfer-partners dataset returned nothing');

  // 7. web_search — metered upstream, guard-tolerant
  const call = await rpc('tools/call', { name: 'instant_answer', arguments: { q: 'spicy food' } });
  console.log('\n== tools/call instant_answer {q:"spicy food"} ==');
  const resultText = call.json?.result?.content?.[0]?.text;
  console.log(resultText);
  if (call.json?.result?.isError) {
    const guarded = !process.env.SPICYTOOLS_MCP_PROXY_SECRET &&
      /403|RapidAPI|proxy|forbidden|fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|network|timed? ?out/i.test(resultText || '');
    if (guarded) {
      console.log('\n[warn] the web-research call could not reach the metered upstream (RapidAPI proxy-secret guard, or no network in this environment) and no SPICYTOOLS_MCP_PROXY_SECRET is set — expected. The local tools above prove the server is wired correctly.');
    } else {
      throw new Error(`tools/call returned isError: ${resultText}`);
    }
  }

  console.log('\nAll smoke tests passed.');
}

main().catch((err) => {
  console.error('\nSMOKE TEST FAILED:', err);
  process.exit(1);
});
