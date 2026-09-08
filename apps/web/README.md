# `apps/web` — the SpicyQuote app

One plain-Node process (no framework) that serves the whole product on one port:

| Route | What it serves |
| :- | :- |
| `/` | the SpicyQuote site — hero, search widget, spice board, agent tools, dataset stats |
| `/widget/*` | the built widget bundle, straight out of `packages/widget/dist` |
| `/api/deals` | the deal feed, rated — `{ count, disclaimer, deals[] }` |
| `/api/tools` | metadata for all 14 MCP tools, read out of the tool registry |
| `/api/datasets` | travel-hacking dataset sizes, sections and freshness dates |
| `/mcp` | the SpicyQuote MCP endpoint, mounted in-process (stateless streamable-HTTP) |
| `/health` | `{ ok, service, tools, dealsInFeed }` |

```bash
npm run dev     # from the repo root → http://localhost:3000
PORT=8080 npm run dev
```

## How the pieces fit

```text
browser ──► app.js ──► SpicyQuote.init({ hotDeals, onSearch })   [packages/widget]
   │            └────► SpicyQuote.applyDeal(deal)                [fills the form]
   └──► /api/deals, /api/tools, /api/datasets                    [this server]
agent ──► /mcp ──► api/mcp.js ──► lib/tools.js ──► lib/dataset.js ──► toolkit/data/*.json
```

The MCP handler is the Vercel function from `packages/mcp/api/mcp.js`, mounted as-is: the server
shims the two Vercel helpers it relies on (`res.status().json()` and a pre-parsed `req.body`), so
the same code path runs locally and in the serverless deployment.

`npm run mcp` runs that handler standalone on `:3900` if you only want the agent endpoint.

## Notes

- The site passes `onSearch` to the widget, so searches are rendered in-page instead of navigating
  to a results URL — good for demos, and the documented hook for building your own results page.
- Static files are served from `public/` with path-traversal protection; `logo.png` lives there too.
- The widget bundle is read from `packages/widget/dist` at request time, so `npm run build` picks up
  widget changes without a copy step.
