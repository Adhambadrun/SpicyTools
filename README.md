<p align="center">
  <img src="logo.png" alt="SpicyQuote" width="110" height="110">
</p>

<h1 align="center">SpicyQuote</h1>

<p align="center">
  <strong>Fares with a kick.</strong> A flight search widget with heat-rated deals, an MCP server
  that lets AI agents hunt hot fares for you, and a travel-hacking dataset to pay for them smartly.
</p>

---

## The idea

Flight search tells you the price. It never tells you whether the price is *good*. SpicyQuote does
one thing that ordinary search forms do not: it rates every fare on a four-chilli heat scale and
puts the hottest ones in front of you.

| Discount vs. the route's usual price | Heat | |
| :- | :- | :- |
| < 20% | `mild` | 🌶 |
| 20–34% | `medium` | 🌶🌶 |
| 35–49% | `hot` | 🌶🌶🌶 |
| 50%+ | `inferno` | 🌶🌶🌶🌶 |

**SpicyQuote never invents a bargain.** Give it a fare with no reference price and it comes back
`mild` at 0% off — it will not pretend your fare is a steal. The same thresholds live in the widget,
the MCP server and the site, so every surface agrees.

## One master tool, three packages, one app

```text
SpicyQuote/
├── apps/web/            the SpicyQuote app: site + REST API + MCP endpoint in one process
├── packages/
│   ├── widget/          @spicyquote/widget   — the embeddable search form + spice rack
│   ├── mcp/             @spicyquote/mcp      — 14 MCP tools for agents
│   ├── bcf-widget/      @spicyquote/bcf-widget — the BCF floating agent panel
│   ├── spicytool/       the search API contract the widget speaks (vendored)
│   └── toolkit/         knowledge layer      — travel-hacking data (vendored, MIT)
└── logo.png
```

| Piece | What it is | Where to read |
| :- | :- | :- |
| **`apps/web`** | One Node process serving the site (`/`), the deal API (`/api/deals`), the tool registry (`/api/tools`), dataset stats (`/api/datasets`) and the MCP endpoint (`/mcp`). | [README](./apps/web/README.md) |
| **`packages/widget`** | React/TypeScript search widget. Embeds anywhere with two files and one `SpicyQuote.init()` call. Owns the spice rack, the heat model and the Smoke & Hot Sauce theme. | [README](./packages/widget/README.md) |
| **`packages/mcp`** | MCP server (streamable-HTTP). Fare tools, nine travel-hacking dataset tools, and three metered web-research tools. | [README](./packages/mcp/README.md) |
| **`packages/bcf-widget`** | The BCF Floating Flight Search Widget: a userscript for `bo.bcflights.com` that detects a lead and opens it in Kayak, Google Flights, ITA Matrix, PointsYeah or SpicyQuote — plus Sabre Fast Search and the agent tool kit. Its link builders are reused by the site. | [README](./packages/bcf-widget/README.md) |
| **`packages/spicytool`** | The search API contract (`/api/v1/*`, `/api/v2/*`) the widget is wired to: airports, priced calendar, award search. Vendored so the interface lives next to the code that implements it. | [README](./packages/spicytool/README.md) |
| **`packages/toolkit`** | Vendored [Travel Hacking Toolkit](https://github.com/borski/travel-hacking-toolkit) data — sweet spots, transfer partners, valuations, award holds, stopovers, status matches, RTW awards, alliances. | [SPICYQUOTE.md](./packages/toolkit/SPICYQUOTE.md) |

## Run it

```bash
npm install     # npm workspaces, Node 18+
npm run dev     # → http://localhost:3000
```

That single command starts the site, the widget bundle, the deal API and `/mcp`. Then:

```bash
curl localhost:3000/api/deals | jq '.deals[0]'
# { "id": "BER-OTP", "departure": "BER", "arrival": "OTP", "price": 62,
#   "baselinePrice": 210, "discountPercent": 70, "heat": "inferno", "peppers": 4, ... }
```

### Other scripts

| Command | What it does |
| :- | :- |
| `npm run dev` | the whole product on `:3000` |
| `npm run build` | production widget bundle into `packages/widget/dist` |
| `npm test` | widget unit tests (jest, 78) + BCF link-builder tests (node:test, 13) |
| `npm run smoke` | end-to-end MCP test (initialize → tools/list → tools/call) |
| `npm run mcp` | the MCP server standalone on `:3900` |
| `npm run widget:dev` | widget dev server on `:9000` |

## Connect an agent

The MCP endpoint is at `/mcp` on the running app (or `:3900/mcp` standalone). Register it in
Claude, ChatGPT, Cursor or any MCP client and ask things like:

> *"Is $232 Cairo → Lisbon a good fare?"* → `spice_meter`
> *"Find me the hottest fares out of CAI."* → `find_hot_deals`
> *"I have Chase points — where should I transfer to fly to Tokyo in business?"* → `transfer_partners`, `award_sweet_spots`, `points_valuations`
> *"Can I hold an award while my points transfer?"* → `award_holds`
> *"Any current sale on that route?"* → `web_search`, `fetch_url`

14 tools, all read-only: **2 fare tools**, **9 travel-hacking tools** (local JSON, unlimited) and
**3 web-research tools** (metered upstream, soft-capped at 30 calls/hour/IP).

## Embed the widget

```html
<div id="root"></div>
<link rel="stylesheet" href="spicyquote.min.css">
<script src="spicyquote.min.js"></script>
<script>
  SpicyQuote.init({
    rootElement: document.getElementById('root'),
    spicyURL: 'https://your-fare-api.example.com',
    locale: 'en',
    hotDeals: [
      { departure: 'CAI', arrival: 'IST', price: 118, baselinePrice: 240, currency: 'USD',
        departDate: '2026-10-09', returnDate: '2026-10-16', label: 'Bosphorus weekend' }
    ],
    onSearch: (info) => console.log(info)
  });
</script>
```

Full option reference, events and theming: [packages/widget/README.md](./packages/widget/README.md).

## The deal feed is sample data

`packages/mcp/data/hot-deals.json` ships with 12 illustrative fares so every surface has something
to chew on. They are **not live quotes** — the disclaimer travels with every `find_hot_deals`
response and every `/api/deals` payload, so nothing downstream can mistake them for real
availability. Replace the file (or point `packages/mcp/lib/dataset.js` at your fare source) before
real travellers see it.

## The search API the widget speaks

SpicyQuote's data layer is the SpicyTool interface — the same shape whether you run the vendored
Python backend in `packages/spicytool/` or your own implementation:

| Endpoint | Purpose |
| :- | :- |
| `GET /api/v1/airports?q=&limit=` | airport typeahead → flat `[{ code, name, city, country, region }]` |
| `GET /api/v1/calendar?origin&destination&start_date&days&cabin` | priced calendar → `{ calendar: [{ date, available, points, cash_fees, program, cabin }] }` |
| `GET /api/v2/search?origin&destination&date&cabin&passengers&max_stops&return_date&return_flex` | the award search the widget's "search" button runs |
| `GET /api/v1/health`, `GET /api/v2/providers` | health and provider list |

Point the widget at one with `apiBase` (`spicyURL` is the deprecated alias):

```js
SpicyQuote.init({ rootElement, apiBase: 'https://your-spicytool-host' });
```

The app in `apps/web` implements the contract too, so the demo runs with no Python backend: it
proxies `/api/v1/*` and `/api/v2/*` to `SPICYTOOL_API_BASE` when that is set, and otherwise answers
airports and programs from the local dataset.

Because SpicyTool prices each calendar day, the widget's datepicker grades cheap days on the heat
scale (`--mild`, `--medium`, `--hot`, `--inferno`) instead of only marking "a flight exists".

## The BCF floating widget

For agents working leads on `bo.bcflights.com`, `packages/bcf-widget` is a Tampermonkey userscript
that floats over the page: detect the lead, then open it anywhere — Kayak, Google Flights
(including the ELR/YVR trick), ITA Matrix (mixed-cabin and multi-city), PointsYeah or SpicyQuote —
and copy the Sabre Fast Search command. It also carries the VIP itinerary maker, GK converter, PNR
how-to and the disclaimer library.

```bash
npm run build --workspace @spicyquote/bcf-widget
# → packages/bcf-widget/dist/bcf-floating-flight-search-widget.user.js
#   also served by the app at /bcf-widget.user.js
```

The link builders (`packages/bcf-widget/src/flight-links.js`) have no DOM dependency, so the site
uses the same code: every fare on the spice board ships with the same outbound links
(`GET /api/deals/:id/links`), and a `?origin=…&destination=…&date=…` deep link from the BCF panel
loads straight into the widget.

## Where this came from

The repository started as three separate uploads:

- `flights.search.widget-master.zip` → **`packages/widget`** — deep-renamed to SpicyQuote (config
  keys, bundle names, CSS tokens, analytics events) and re-themed. Migration table in
  [the widget README](./packages/widget/README.md#renamed-from-flightssearchwidget).
- `agentsearch-mcp-master.zip` → **`packages/mcp`** — kept as a thin MCP connector, then extended
  from 3 web tools to 14 (fare + travel-hacking + web).
- `travel-hacking-toolkit-main.zip` → **`packages/toolkit`** — vendored verbatim (MIT,
  [borski/travel-hacking-toolkit](https://github.com/borski/travel-hacking-toolkit)); SpicyQuote
  consumes its data through the MCP tools rather than forking its skills.

Two later uploads joined it:

- `SpicyTool-main.zip` → **`packages/spicytool/`** — the search API. Rather than wrapping it, the
  widget's data layer was rewired to speak its contract directly (`services/spicytool.ts`), and the
  app serves the same endpoints.
- `TBC Floating Flight Search Widget.txt` → **`packages/bcf-widget/`** — ported feature-for-feature
  with every reference to TBC / `bo.travelbusinessclass.com` replaced by BCF / `bo.bcflights.com`,
  re-skinned to Smoke & Hot Sauce, and its flybasis leg button re-pointed at SpicyQuote.

The widget's two third-party forks have been dropped entirely: `@spicyquote/react-datepicker` and
`@spicyquote/react-select` are aliases onto the upstream `react-datepicker` and `react-select`
packages (one line each in `webpack.common.js`), so the tree carries no vendor-specific deps.

## CI

`ci/github-actions.yml` is the GitHub Actions workflow (build → widget tests → MCP smoke test → app
boot check). Copy it to `.github/workflows/ci.yml` to enable it — the integration that pushes these
branches is not permitted to create workflow files directly.

## License

MIT — except `packages/toolkit/`, which is MIT © Michael Borohovski and vendored verbatim.
