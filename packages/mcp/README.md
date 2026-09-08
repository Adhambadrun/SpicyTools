# `@spicyquote/mcp` — the SpicyQuote MCP server

One MCP endpoint that lets any agent answer the only two questions that matter when
booking a trip: **how hot is this fare?** and **what is the smartest way to pay for it?**

It exposes **14 read-only tools** over MCP streamable-HTTP at a single `/mcp` URL, so
Claude, ChatGPT, Cursor or any other MCP client can register it with one line.

| Family | Tools | Needs the network? |
| :- | :- | :- |
| **Fares** | `spice_meter`, `find_hot_deals` | No — bundled data + arithmetic |
| **Travel hacking** | `award_sweet_spots`, `transfer_partners`, `points_valuations`, `award_holds`, `stopovers`, `status_match`, `rtw_awards`, `alliances`, `partner_awards` | No — reads `packages/toolkit/data/*.json` |
| **Web research** | `web_search`, `instant_answer`, `fetch_url` | Yes — metered upstream |

## The heat scale

SpicyQuote never invents a bargain. Give a tool a price and the price the route
normally sells at and it rates the fare:

| Discount vs. baseline | Heat | Chillies |
| :- | :- | :- |
| < 20% | `mild` | 🌶 |
| 20–34% | `medium` | 🌶🌶 |
| 35–49% | `hot` | 🌶🌶🌶 |
| 50%+ | `inferno` | 🌶🌶🌶🌶 |

No baseline? No invented heat — the fare comes back `mild` at 0% off. The same
thresholds live in `packages/widget/src/deals.ts`, so the widget and the agent
always agree.

## Quick start

```bash
npm install                 # from the repo root (npm workspaces)
npm run mcp                 # starts the local server on :3900
npm run smoke               # end-to-end test: initialize → tools/list → tools/call
```

```bash
curl -s localhost:3900/health | jq
# { "ok": true, "service": "spicyquote-mcp", "dealsInFeed": 12, ... }
```

Register it in a client with `http://localhost:3900/mcp`.

## Tools

### Fares

- **`spice_meter`** — `{ price, baselinePrice?, currency? }` → discount %, heat level,
  chilli count, one-line verdict. Pure arithmetic.
- **`find_hot_deals`** — `{ from?, to?, maxPrice?, minHeat?, limit? }` → the deal feed,
  hottest first. This is the same feed the search widget renders as its *spice rack*,
  and every deal is a loadable fare (airports, price, dates) an agent can hand to the
  widget or a booking flow.

### Travel hacking (from `packages/toolkit/data`)

- **`award_sweet_spots`** — outsized-value redemptions. `{ program?, query?, limit? }`
- **`transfer_partners`** — card → loyalty transfer ratios and transfer times.
  Ratio is *points out per 1 point in*: `1.0` is 1:1, `0.8` means 1,000 → 800. `{ card?, program?, limit? }`
- **`points_valuations`** — cents-per-point per program/currency, with source and bias. `{ program?, limit? }`
- **`award_holds`** — who lets you hold an award before transferring points. `{ program?, limit? }`
- **`stopovers`** — free two-cities-for-one rules. `{ program?, limit? }`
- **`status_match`** — matches and challenges, including the once-per-lifetime traps. `{ program?, limit? }`
- **`rtw_awards`** — round-the-world mileage bands and routing rules. `{ alliance?, limit? }`
- **`alliances`** — who flies with whom. `{ alliance?, airline?, limit? }`
- **`partner_awards`** — which program can book which airline. `{ program?, airline?, limit? }`

### Web research (metered)

- **`web_search`** — provider-abstracted SERP (`brave` or `serper`).
- **`instant_answer`** — keyless DuckDuckGo instant answers.
- **`fetch_url`** — SSRF-guarded URL → clean text/markdown for RAG.

## The deal feed is sample data

`data/hot-deals.json` ships with 12 illustrative fares so the tools and the widget
have something to chew on. **They are not live quotes.** Replace the file (or swap
`lib/dataset.js` for your fare source) before pointing real users at it — the
disclaimer travels with every `find_hot_deals` response, so nobody downstream can
mistake it for live availability.

## Authentication: none, deliberately

The fare and dataset tools are pure local computation over JSON that ships with the
repo, and the web tools return public web data. There is no per-user dimension to
gate, so this server runs with no OAuth, no sessions, no database and no billing.
The only credential involved is the *outbound* proxy secret below, held server-side.

## Environment variables

| Var | Default | Purpose |
| :- | :- | :- |
| `SPICYQUOTE_MCP_API_BASE_URL` | `https://agentsearch-api.vercel.app` | Upstream web-search API. |
| `SPICYQUOTE_MCP_PROXY_SECRET` | _(empty)_ | RapidAPI proxy secret sent as `X-RapidAPI-Proxy-Secret`. Without it the guarded `/v1/*` routes return 403. |
| `SPICYQUOTE_MCP_RATE_LIMIT` | `30` | Soft per-IP `tools/call` cap per hour (in-memory, per instance). |
| `PORT` | `3900` | Local dev server port. |

## Project layout

```text
api/mcp.js        MCP endpoint (StreamableHTTPServerTransport, stateless, no caller auth)
api/health.js     GET /health — service, deal-feed size, feed freshness
lib/tools.js      All 14 tool definitions (zod schemas + handlers)
lib/dataset.js    Read-only loader for the bundled JSON datasets
lib/ratelimit.js  Soft per-IP cap on the metered web tools
data/hot-deals.json  SpicyQuote deal feed (SAMPLE DATA — replace it)
local-server.js   Plain-Node dev server (not deployed)
test/smoke.mjs    Real end-to-end test: health, initialize, tools/list, tools/call
vercel.json       Routes /mcp → api/mcp.js, /health → api/health.js
server.json       MCP registry manifest
```

## Deploying

`vercel.json` is ready: `vercel deploy` from this directory publishes
`/mcp` and `/health` as serverless functions. Set the three `SPICYQUOTE_MCP_*`
variables in the project settings, then register `https://<deployment>/mcp` in your
MCP client.

## Upstream and credit

The web-research trio passes through to the [AgentSearch API](https://agentsearch-api.vercel.app),
which is metered and gates `/v1/*` behind a RapidAPI proxy-secret guard. This server
authenticates its own outbound calls with that secret and applies a soft per-IP rate
limit so the free MCP tier stays a discovery channel rather than an unmetered bypass
of the paid listing. Heavy volume should go through AgentSearch on RapidAPI/Apify.
