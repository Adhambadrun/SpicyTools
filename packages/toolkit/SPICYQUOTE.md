# The toolkit inside SpicyQuote

SpicyQuote answers two questions: **is this fare hot?** and **what is the smartest way to pay for it?**
The first one is arithmetic (see the [heat scale](#heat-scale)). The second one needs knowledge —
which program to transfer to, who charges fuel surcharges, which award can be held while the points
land. That knowledge is what this directory provides.

## What SpicyQuote takes from it

SpicyQuote does **not** re-ship the skills, agents, hooks or Docker images. It takes the
**data** — nine JSON files in `data/` — and serves them as MCP tools from `packages/mcp`:

| Dataset | MCP tool | What it answers |
| :- | :- | :- |
| `sweet-spots.json` | `award_sweet_spots` | Which redemptions are absurdly good value? |
| `transfer-partners.json` | `transfer_partners` | Where can my card points go, at what ratio? |
| `points-valuations.json` | `points_valuations` | What is a point actually worth? |
| `award-holds.json` | `award_holds` | Can I hold this seat while my points transfer? |
| `stopovers.json` | `stopovers` | Can I get two cities for one award? |
| `status-match.json` | `status_match` | Who will match my elite status, and what does it cost? |
| `rtw-awards.json` | `rtw_awards` | What does a round-the-world ticket cost in miles? |
| `alliances.json` | `alliances` | Which airlines fly together? |
| `partner-awards.json` | `partner_awards` | Can program X book airline Y? |

The loader is `packages/mcp/lib/dataset.js` — a read-only `fs` read plus a cache, with dataset
names listed in `apps/web/server.mjs`. Adding a dataset means dropping the JSON in `data/` and
registering a tool for it.

## Heat scale

Shared by the widget (`packages/widget/src/deals.ts`), the MCP server
(`packages/mcp/lib/tools.js`) and the site:

| Discount vs. baseline | Heat | Chillies |
| :- | :- | :- |
| < 20% | `mild` | 🌶 |
| 20–34% | `medium` | 🌶🌶 |
| 35–49% | `hot` | 🌶🌶🌶 |
| 50%+ | `inferno` | 🌶🌶🌶🌶 |

No baseline price, no invented heat — the fare comes back `mild` at 0% off.

## Freshness

Every dataset carries `_meta.last_updated` and `_meta.staleness_days`. `apps/web/server.mjs`
surfaces those dates at `/api/datasets`, and the toolkit's own
`scripts/check-data-freshness.sh` can fail a build when data goes stale — worth wiring into CI
before trusting these numbers in production.

## Upstream

This directory is a verbatim vendored copy of
[borski/travel-hacking-toolkit](https://github.com/borski/travel-hacking-toolkit) by Michael
Borohovski, MIT licensed. Skill names, plugin manifests and upstream links are deliberately left
untouched so upstream changes can be merged cleanly. If you are improving award data, contribute it
upstream — SpicyQuote picks it up on the next sync.
