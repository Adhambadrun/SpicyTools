# @spicyquote/bcf-widget

The **BCF Floating Flight Search Widget** — the agent-side half of SpicyQuote.

It is a userscript that floats over <https://bo.bcflights.com>: it detects the lead you
are looking at and offers every way an agent would want to search it.

Ported from the `TBC Floating Flight Search Widget` (v12.2); every reference to
TBC / `bo.travelbusinessclass.com` has been re-pointed at BCF / `bo.bcflights.com`, the
flybasis leg button now opens SpicyQuote, and the palette is SpicyQuote's *dark smoke &
hot sauce*.

```
packages/bcf-widget/
├── src/flight-links.js   pure URL builders — no DOM, usable from Node
├── src/widget.js         the floating panel, lead detection, embedded tools
├── build.mjs             concatenates the two into one userscript
├── dist/                 build output (git-ignored)
└── test/                 node:test suite pinning every generated URL
```

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or Violentmonkey.
2. Build the bundle: `npm run build --workspace @spicyquote/bcf-widget`
3. Create a new userscript, paste
   `packages/bcf-widget/dist/bcf-floating-flight-search-widget.user.js`, save.
4. Open any lead on `bo.bcflights.com/leads/…`.

The script is also served by the SpicyQuote app at `/bcf-widget.user.js`, so an install
can point at `https://<your-host>/bcf-widget.user.js`.

## Features

| Area | What it does |
| --- | --- |
| Lead detection | Reads the lead card on screen (`#id`, route, dates, pax, cabin) and cross-checks any ITA Matrix itinerary link on the page; re-detects on navigation (⟳). |
| Route card | Origin → destination, trip type (one-way / round trip / multi-city / open jaw), season badge, lead name and ID. |
| Lead search | Type a name or `#id` to jump between the leads already on screen. |
| Cabin + flex | Cabin override (Y / W / B / F) and ±0–3 flexible days, applied to every link. |
| Kayak | `/flights/CAI-JFK/<date>[-flexible-Ndays]/<return>/<cabin>/<pax>adults`. |
| Google Flights | Builds the protobuf `tfs=` payload by hand — including the ELR variant that appends a YVR leg. |
| ITA Matrix | One-way / round-trip / multi-city payloads, mixed-cabin per leg, date modifiers. |
| PointsYeah | Per-leg award search with the flex window expanded into `departDate`/`departDateSec`. |
| SpicyQuote | Per-leg deep link into our own engine (`?origin=…&destination=…&date=…&cabin=…&passengers=…`). |
| Fast Search | Copies the Sabre command (`JR.CAI/S-OCJFK15SEP…`), inserting `/S-ARUNK` for broken multi-city routings. |
| Tools | VIP itinerary maker, GK converter, how to make a PNR, disclaimers & scripts. |
| Shell | Draggable by its header, collapses to a pepper bubble, glassmorphic dark-sauce theme. |

## Using the builders from Node

`src/flight-links.js` has no DOM dependencies, so the SpicyQuote site renders the same
links for its own deals (`apps/web/server.mjs` → `GET /api/deals/:id/links`).

```js
const links = require('@spicyquote/bcf-widget');

const lead = {
  origin: 'CAI', destination: 'JFK', cabin: 'B',
  departureDate: '2026-09-15', returnDate: '2026-09-29',
  adults: 2, children: 1, infants: 0
};

links.buildKayakUrl(lead, 0);
// https://www.kayak.com/flights/CAI-JFK/2026-09-15/2026-09-29/business/2adults/children-8?sort=bestflight_a

links.buildFastSearchCommand(lead);
// JR.CAI/S-OCJFK15SEP/S-OCCAI29SEP

links.setSearchBase('https://fares.example.com');
links.buildSpicyQuoteUrl(lead, { origin: 'CAI', destination: 'JFK', date: '2026-09-15' });
// https://fares.example.com/?origin=CAI&destination=JFK&date=2026-09-15&cabin=business&passengers=3
```

Exports: `buildKayakUrl`, `buildGoogleFlightsUrl`, `buildMatrixUrl`, `buildPointsYeahUrl`,
`buildSpicyQuoteUrl`, `buildFastSearchCommand`, `setSearchBase`, plus the date/cabin/trip
helpers (`cabinLabel`, `seasonInfo`, `daysBetween`, `addDays`, `fmtDate`, `leadSegments`,
`isOpenJaw`, `searchLegs`, `tripTypeLabel`, `itaDateModifier`, `SPICYQUOTE_CABINS`).

In the browser the userscript also publishes them on `window.BCF`:

```js
window.BCF.setSearchBase('https://fares.example.com');
window.BCF.currentLead;        // the detected lead
window.BCF.buildKayakUrl(window.BCF.currentLead, 3);
```

## Tests

```bash
npm test --workspace @spicyquote/bcf-widget
```

Pins every generated URL, the base64url protobuf payload, the base64 ITA Matrix payload,
the Sabre ARNK behaviour and the date/season helpers.
