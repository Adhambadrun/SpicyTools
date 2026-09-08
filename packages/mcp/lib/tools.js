// lib/tools.js — SpicyQuote MCP tool definitions.
//
// Three families of tools, all read-only:
//
//   1. Fare tools        — `spice_meter` (rate any fare) and `find_hot_deals`
//                          (query the deal feed that also drives the widget's
//                          spice rack). Pure local computation + bundled data.
//   2. Travel-hacking    — the dataset that ships in packages/toolkit/data
//                          (sweet spots, transfer partners, valuations, award
//                          holds, stopovers, status matches, RTW, alliances).
//   3. Web research      — `web_search`, `instant_answer`, `fetch_url`, thin
//                          pass-throughs to the metered AgentSearch REST API.
//
// Only the web-research trio touches the network, and only they are metered
// upstream — see lib/ratelimit.js for the soft per-IP cap that keeps this a
// discovery tier.

import { z } from 'zod';

import { loadDataset, queryDataset, metaOf, entries } from './dataset.js';

const BASE_URL = (process.env.SPICYQUOTE_MCP_API_BASE_URL || 'https://agentsearch-api.vercel.app').replace(/\/+$/, '');
const PROXY_SECRET = process.env.SPICYQUOTE_MCP_PROXY_SECRET || '';

const asText = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const asError = (err) => ({
  isError: true,
  content: [{ type: 'text', text: `Error: ${err.message || String(err)}` }],
});

// Nothing here writes anything. `openWorldHint` is true for the tools that
// reflect live, externally-changing data (the web trio); the bundled-dataset
// tools are closed-world.
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const RO_CLOSED = { ...RO, openWorldHint: false };

// ---------------------------------------------------------------------------
// Heat model — keep in sync with packages/widget/src/deals.ts
// ---------------------------------------------------------------------------

const HEAT_LEVELS = ['mild', 'medium', 'hot', 'inferno'];
const PEPPERS = { mild: 1, medium: 2, hot: 3, inferno: 4 };

function discountOf(deal) {
  if (!deal || !deal.baselinePrice || deal.baselinePrice <= 0 || !deal.price) return 0;
  const discount = (1 - deal.price / deal.baselinePrice) * 100;
  return discount > 0 ? Math.round(discount) : 0;
}

function heatOf(deal) {
  const discount = discountOf(deal);
  if (discount >= 50) return 'inferno';
  if (discount >= 35) return 'hot';
  if (discount >= 20) return 'medium';
  return 'mild';
}

const VERDICT = {
  mild: 'Fair fare — nothing to phone home about.',
  medium: 'Warmer than usual. Worth a look if the dates work.',
  hot: 'Hot. Book it before someone else does.',
  inferno: 'Inferno. Do not think twice.',
};

/** Decorate a raw deal with its heat rating. Exported for the smoke test. */
export function rateDeal(deal) {
  const heat = heatOf(deal);
  const discount = discountOf(deal);

  return {
    ...deal,
    discountPercent: discount,
    heat,
    peppers: PEPPERS[heat],
    verdict: VERDICT[heat],
  };
}

function dealsFromFeed() {
  return entries(loadDataset('hot-deals', 'own')).map(([id, deal]) => ({ id, ...deal }));
}

// ---------------------------------------------------------------------------
// Dataset helpers
// ---------------------------------------------------------------------------

function datasetResult(name, { needle, limit } = {}, note) {
  const data = loadDataset(name);
  const subset = queryDataset(data, { needle, limit });
  const count = Object.keys(subset).length;

  return {
    dataset: name,
    count,
    ...(note ? { note } : {}),
    source: metaOf(data),
    results: subset,
  };
}

// ---------------------------------------------------------------------------
// AgentSearch pass-through (the only metered tools)
// ---------------------------------------------------------------------------

function buildUrl(path, params = {}) {
  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function callUpstream(path, params) {
  const url = buildUrl(path, params);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  let res;

  try {
    const headers = { accept: 'application/json' };
    if (PROXY_SECRET) headers['X-RapidAPI-Proxy-Secret'] = PROXY_SECRET;
    res = await fetch(url, { headers, signal: controller.signal });
  } catch (e) {
    throw new Error(`AgentSearch API request failed (${url.pathname}${url.search}): ${e.message || e}`);
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    const message = body?.error?.message || `AgentSearch API returned HTTP ${res.status} for ${url.pathname}${url.search}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

function forward(mapper) {
  return async (args = {}) => {
    try {
      const { path, params } = mapper(args);
      return asText(await callUpstream(path, params));
    } catch (err) {
      return asError(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTools(server) {
  // --- Fare tools ---------------------------------------------------------
  server.registerTool(
    'spice_meter',
    {
      title: 'Rate how spicy a fare is',
      description:
        'Turn a fare into a SpicyQuote heat rating. Pass the current price and the price the route normally sells at (baselinePrice) and you get back a discount percentage, a heat level (mild/medium/hot/inferno), the matching chilli count and a one-line verdict. Thresholds: <20% off = mild, 20-34% = medium, 35-49% = hot, 50%+ = inferno. No baseline means no invented heat — the fare comes back mild with a 0% discount. Pure arithmetic, no network calls.',
      inputSchema: {
        price: z.number().describe('Fare being offered.'),
        baselinePrice: z.number().optional().describe('Typical fare for this route. Without it the heat is always mild.'),
        currency: z.string().optional().describe('ISO-4217 code, e.g. USD. Cosmetic only.'),
      },
      annotations: RO_CLOSED,
    },
    async (args = {}) => asText(rateDeal(args))
  );

  server.registerTool(
    'find_hot_deals',
    {
      title: 'Find hot fares',
      description:
        'Search the SpicyQuote deal feed — the same feed the search widget renders as its "spice rack". Filter by origin/destination IATA code, maximum price and minimum heat level; results come back hottest first. Every deal is a loadable fare (departure, arrival, price, dates) so an agent can hand it straight to the widget or to a booking flow. NOTE: the bundled feed is sample data (see the disclaimer in the response) — point the server at a real fare feed before trusting prices in production.',
      inputSchema: {
        from: z.string().optional().describe('Departure IATA code, e.g. CAI.'),
        to: z.string().optional().describe('Arrival IATA code, e.g. IST.'),
        maxPrice: z.number().optional().describe('Drop anything priced above this.'),
        minHeat: z.enum(['mild', 'medium', 'hot', 'inferno']).optional().describe('Coolest heat level you will accept.'),
        limit: z.number().int().min(1).max(50).optional().describe('Max deals to return. Default 10.'),
      },
      annotations: RO_CLOSED,
    },
    async (args = {}) => {
      const { from, to, maxPrice, minHeat, limit = 10 } = args;
      const floor = minHeat ? HEAT_LEVELS.indexOf(minHeat) : 0;

      const deals = dealsFromFeed()
        .map(rateDeal)
        .filter((deal) => (!from || deal.departure === from.toUpperCase()))
        .filter((deal) => (!to || deal.arrival === to.toUpperCase()))
        .filter((deal) => (maxPrice === undefined || deal.price <= maxPrice))
        .filter((deal) => HEAT_LEVELS.indexOf(deal.heat) >= floor)
        .sort((a, b) => HEAT_LEVELS.indexOf(b.heat) - HEAT_LEVELS.indexOf(a.heat) || a.price - b.price)
        .slice(0, Math.max(1, Math.min(Number(limit) || 10, 50)));

      return asText({
        count: deals.length,
        filters: { from: from || null, to: to || null, maxPrice: maxPrice ?? null, minHeat: minHeat || null },
        disclaimer: metaOf(loadDataset('hot-deals', 'own')).disclaimer,
        deals,
      });
    }
  );

  // --- Travel-hacking dataset --------------------------------------------
  server.registerTool(
    'award_sweet_spots',
    {
      title: 'Award sweet spots',
      description:
        'High-value award redemptions where points buy far more than they should — the outliers worth booking before the next devaluation. Filter by loyalty program (e.g. "turkish", "aeroplan", "virgin") or free-text query, and always re-check the rate on the program site before booking: sweet spots die with award chart changes.',
      inputSchema: {
        program: z.string().optional().describe('Loyalty program name or key, e.g. "Air Canada Aeroplan".'),
        query: z.string().optional().describe('Free-text search across the dataset, e.g. "Tokyo business class".'),
        limit: z.number().int().min(1).max(50).optional().describe('Max entries. Default 10.'),
      },
      annotations: RO_CLOSED,
    },
    async (args = {}) =>
      asText(datasetResult('sweet-spots', { needle: args.program || args.query, limit: args.limit }))
  );

  server.registerTool(
    'transfer_partners',
    {
      title: 'Points transfer partners',
      description:
        'Which airline and hotel loyalty programs a credit card currency transfers to, at what ratio, and how long the transfer takes. Ratio is points_out per 1 point_in: 1.0 is 1:1, 0.8 means 1,000 points become 800 miles. Filter by card (amex, chase, bilt, capital_one, citi) or by the target airline/hotel program.',
      inputSchema: {
        card: z.string().optional().describe('Card currency key or name, e.g. "chase".'),
        program: z.string().optional().describe('Target loyalty program, e.g. "Air France/KLM Flying Blue".'),
        limit: z.number().int().min(1).max(50).optional().describe('Max entries. Default 10.'),
      },
      annotations: RO_CLOSED,
    },
    async (args = {}) =>
      asText(datasetResult('transfer-partners', { needle: args.card || args.program, limit: args.limit }))
  );

  server.registerTool(
    'points_valuations',
    {
      title: 'What points are worth',
      description:
        'Cents-per-point valuations for the major loyalty programs and card currencies, with the source each figure comes from and its known bias (publisher valuations skew optimistic). Use it to sanity-check whether a redemption is actually good value.',
      inputSchema: {
        program: z.string().optional().describe('Program or currency, e.g. "Chase Ultimate Rewards".'),
        limit: z.number().int().min(1).max(50).optional().describe('Max entries. Default 20.'),
      },
      annotations: RO_CLOSED,
    },
    async (args = {}) =>
      asText({
        ...datasetResult('points-valuations', { needle: args.program, limit: args.limit || 20 }),
        note: 'Cents-per-point. Higher is better, but publisher valuations are systematically optimistic — treat them as an upper bound.',
      })
  );

  server.registerTool(
    'award_holds',
    {
      title: 'Award holds',
      description:
        'Which loyalty programs let you hold an award ticket before paying or transferring points, for how long, and how. Critical when the points have to be transferred from a card: the transfer can take hours or days and the seat will not wait. Also covers the programs that do NOT allow holds.',
      inputSchema: {
        program: z.string().optional().describe('Program name or key, e.g. "AA AAdvantage".'),
        limit: z.number().int().min(1).max(50).optional().describe('Max entries. Default 10.'),
      },
      annotations: RO_CLOSED,
    },
    async (args = {}) => asText(datasetResult('award-holds', { needle: args.program, limit: args.limit }))
  );

  server.registerTool(
    'stopovers',
    {
      title: 'Stopover rules',
      description:
        'Per-program stopover rules for award tickets. A stopover is an extended layover (usually 24h+) that turns one trip into two cities for the price of one award. Includes which programs charge extra, how many stopovers are allowed, and the confidence level of each rule.',
      inputSchema: {
        program: z.string().optional().describe('Program name or key, e.g. "Turkish Miles&Smiles".'),
        limit: z.number().int().min(1).max(50).optional().describe('Max entries. Default 10.'),
      },
      annotations: RO_CLOSED,
    },
    async (args = {}) => asText(datasetResult('stopovers', { needle: args.program, limit: args.limit }))
  );

  server.registerTool(
    'status_match',
    {
      title: 'Status match and challenge programs',
      description:
        'Airline and hotel status matches and challenges: what status you get, what it costs, how long it lasts, and the lifetime/once-per-N-years restrictions that make a wasted match unrecoverable. Every entry carries a confidence marker (VERIFIED / LIKELY / UNVERIFIED).',
      inputSchema: {
        program: z.string().optional().describe('Program name or key, e.g. "Alaska Mileage Plan".'),
        limit: z.number().int().min(1).max(50).optional().describe('Max entries. Default 10.'),
      },
      annotations: RO_CLOSED,
    },
    async (args = {}) => asText(datasetResult('status-match', { needle: args.program, limit: args.limit }))
  );

  server.registerTool(
    'rtw_awards',
    {
      title: 'Round-the-world awards',
      description:
        'Round-the-world and multi-continent award tickets: mileage bands by distance, how many stopovers are allowed, which alliances and programs offer them, and the gotchas (fuel surcharges, routing rules, booking channels).',
      inputSchema: {
        alliance: z.string().optional().describe('Alliance or program, e.g. "star_alliance".'),
        limit: z.number().int().min(1).max(50).optional().describe('Max entries. Default 10.'),
      },
      annotations: RO_CLOSED,
    },
    async (args = {}) => asText(datasetResult('rtw-awards', { needle: args.alliance, limit: args.limit }))
  );

  server.registerTool(
    'alliances',
    {
      title: 'Airline alliances',
      description:
        'Alliance membership: which airlines belong to Star Alliance, oneworld and SkyTeam, their hubs and loyalty programs. Use it to work out which program can book which airline before hunting for award space.',
      inputSchema: {
        alliance: z.string().optional().describe('Alliance key or name, e.g. "oneworld".'),
        airline: z.string().optional().describe('Airline name or IATA code, e.g. "QR".'),
        limit: z.number().int().min(1).max(50).optional().describe('Max entries. Default 10.'),
      },
      annotations: RO_CLOSED,
    },
    async (args = {}) => asText(datasetResult('alliances', { needle: args.alliance || args.airline, limit: args.limit }))
  );

  server.registerTool(
    'partner_awards',
    {
      title: 'Who can book which airline',
      description:
        'Which loyalty programs can book award seats on which airlines — alliance, bilateral and cross-alliance partnerships. Answers "can I redeem program X on airline Y" and whether it can be booked online.',
      inputSchema: {
        program: z.string().optional().describe('Booking program, e.g. "Aeroplan".'),
        airline: z.string().optional().describe('Operating airline, e.g. "Emirates".'),
        limit: z.number().int().min(1).max(50).optional().describe('Max entries. Default 10.'),
      },
      annotations: RO_CLOSED,
    },
    async (args = {}) =>
      asText(datasetResult('partner-awards', { needle: args.program || args.airline, limit: args.limit }))
  );

  // --- Web research (metered upstream) ------------------------------------
  server.registerTool(
    'web_search',
    {
      title: 'Web search (SERP)',
      description:
        'Search the web via a provider-abstracted backend (Brave or Serper). Returns normalized results with position, title, url, snippet and domain. Use it for research a bundled dataset cannot answer — fare sales, route news, visa rules. Metered upstream; see the rate limit note in the tool error if you hit it.',
      inputSchema: {
        q: z.string().describe('Search query.'),
        provider: z.enum(['brave', 'serper']).optional().describe('Force a provider. Omit to use whichever is configured.'),
        limit: z.number().int().min(1).max(20).optional().describe('Max results, 1-20. Default 10.'),
        country: z.string().optional().describe('ISO-3166 alpha-2 region, lowercase. Default us.'),
      },
      annotations: RO,
    },
    forward(({ q, provider, limit, country }) => ({ path: '/v1/search', params: { q, provider, limit, country } }))
  );

  server.registerTool(
    'instant_answer',
    {
      title: 'Instant answer (keyless)',
      description:
        'DuckDuckGo instant answers — definitions, entities, quick facts. Not a full SERP; use web_search for that. Keyless, but still metered upstream by this connector.',
      inputSchema: {
        q: z.string().describe('Query.'),
      },
      annotations: RO,
    },
    forward(({ q }) => ({ path: '/v1/answer', params: { q } }))
  );

  server.registerTool(
    'fetch_url',
    {
      title: 'Fetch a URL as clean text/markdown (RAG-ready)',
      description:
        'Fetch any public http(s) URL, strip boilerplate, and return clean text or markdown ready for an LLM context window. SSRF-guarded — refuses private/loopback/internal hosts. Use it to read an airline sale page or a fare rules page end to end.',
      inputSchema: {
        url: z.string().describe('Public http(s) URL to fetch.'),
        format: z.enum(['text', 'markdown']).optional().describe('Output format. Default text.'),
        maxChars: z.number().int().min(500).max(500000).optional().describe('Max characters returned. Default 100000.'),
        links: z.boolean().optional().describe('Also return up to 50 extracted links. Default false.'),
      },
      annotations: RO,
    },
    forward(({ url, format, maxChars, links }) => ({ path: '/v1/fetch', params: { url, format, maxChars, links } }))
  );
}

export const BASE_URL_FOR_HEALTH = BASE_URL;
