# `apps/web` — the SpicyTools app

One plain-Node process (no framework) that serves the whole product on one port:

| Route | What it serves |
| :- | :- |
| `/` | the SpicyTools site — hero, search widget, spice board, agent tools, dataset stats |
| `/widget/*` | the built widget bundle, straight out of `packages/widget/dist` |
| `/api/deals` | the deal feed, rated — `{ count, disclaimer, deals[] }` (add `?links=1` for the outbound search links) |
| `/api/deals/:id/links` | Kayak / Google Flights / ITA Matrix / PointsYeah / SpicyTools links + the Sabre command for one fare |
| `/api/v1/*`, `/api/v2/*` | SpicyTool-shaped search API: airports typeahead, priced calendar, award search, providers, health |
| `/bcf-widget.user.js` | the BCF floating widget userscript, straight out of `packages/bcf-widget/dist` |
| `/terminal` | SpicyTools Terminal — the single-file page built into `packages/terminal/public` |
| `/api/terminal/convert` | `POST { text }` → GDS black-window itinerary, straight from the Terminal engine |
| `/link/` , `/link/app.html` | SpicyTools Link (login + tool). `app.html` is only served with a valid session cookie |
| `/link/api/*` | its sign-in API: `request-code`, `verify`, `session`, `health` |
| `/api/tools` | metadata for all 15 MCP tools, read out of the tool registry |
| `/api/datasets` | travel-hacking dataset sizes, sections and freshness dates |
| `/mcp` | the SpicyTools MCP endpoint, mounted in-process (stateless streamable-HTTP) |
| `/health` | `{ ok, service, tools, dealsInFeed }` |

```bash
npm run dev     # from the repo root → http://localhost:3000
PORT=8080 npm run dev
SPICYTOOL_API_BASE=https://your-spicytool-host npm run dev   # proxy the search API
```

Set `SPICYTOOL_API_BASE` to proxy `/api/v1/*` and `/api/v2/*` to a real SpicyTool deployment.
Without it the server answers the same contract from the local dataset (airports typeahead from
`packages/spicytool/backend/data/airports.json`, programs from the deal feed), so the demo runs
standalone.

## How the pieces fit

```text
browser ──► app.js ──► SpicyTools.init({ hotDeals, onSearch })   [packages/widget]
   │            └────► SpicyTools.applyDeal(deal)                [fills the form]
   └──► /api/deals, /api/tools, /api/datasets                    [this server]
agent ──► /mcp ──► api/mcp.js ──► lib/tools.js ──► lib/dataset.js ──► toolkit/data/*.json
```

The MCP handler is the Vercel function from `packages/mcp/api/mcp.js`, mounted as-is: the server
shims the two Vercel helpers it relies on (`res.status().json()` and a pre-parsed `req.body`), so
the same code path runs locally and in the serverless deployment.

`npm run mcp` runs that handler standalone on `:3900` if you only want the agent endpoint.

Terminal and Link are the same process too: the Terminal page is served from
`packages/terminal/public/index.html` (built output), and Link's four Vercel-style handlers are
imported from `packages/link/api/*` and mounted under `/link/api/*` — the same
`res.status().json()` shim the MCP handler uses. Link needs `RESEND_API_KEY` to email approval
codes; without it the handlers run in local mode and the code is printed to the console and
returned in the response.

## Notes

- The site passes `onSearch` to the widget, so searches are rendered in-page instead of navigating
  to a results URL — good for demos, and the documented hook for building your own results page.
- Static files are served from `public/` with path-traversal protection; `logo.png` lives there too.
- This `public/` is the **source** of the site, not a build output. The deployable static bundle is
  assembled into the *repo-root* `public/` by `tools/build-site.mjs` (`npm run site`) — that is the
  folder `vercel.json#outputDirectory` points Vercel at, and it takes the Terminal page from
  `packages/terminal/public`, the widget bundle from `packages/widget/dist` and the userscript from
  `packages/bcf-widget/dist`. Running `npm run dev` here is unchanged: the app reads those build
  directories directly and needs no `public/` at the repo root.
- The widget bundle is read from `packages/widget/dist` at request time, so `npm run build` picks up
  widget changes without a copy step. Same for the BCF userscript in `packages/bcf-widget/dist`.
