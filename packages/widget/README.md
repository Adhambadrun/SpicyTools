# `@spicytools/widget` — the SpicyTools search widget

An embeddable flight search form with a **spice rack**: a rail of heat-rated fares above the form
that fills the search in one tap. Drop it on any page with two files and one function call.

```html
<div id="root"></div>
<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Open+Sans:400,600,700&display=swap">
<link rel="stylesheet" href="spicytools.min.css">
<script src="spicytools.min.js"></script>
<script>
  SpicyTools.init({
    rootElement: document.getElementById('root'),
    apiBase: 'https://your-fare-api.example.com',
    locale: 'en',
    hotDeals: [
      { departure: 'CAI', arrival: 'IST', price: 118, baselinePrice: 240, currency: 'USD',
        departDate: '2026-10-09', returnDate: '2026-10-16', label: 'Bosphorus weekend' }
    ]
  });
</script>
```

Live examples ship in [`dist/`](./dist): `index.html` (showcase), `demo.html` (every option, live),
`websky.html` (Websky mode).

## The spice rack

`hotDeals` takes fares you already have — from your fare feed, a sale, a campaign — and the widget
works out how hot each one is, sorts hottest-first and renders it as a tappable card. Tapping a card
fills the whole form (route, dates, trip type) and runs the search.

```js
{ departure: 'CAI', arrival: 'IST', price: 118, baselinePrice: 240, currency: 'USD',
  departDate: '2026-10-09', returnDate: '2026-10-16', directFlight: true, label: 'Bosphorus weekend' }
```

| Field | Type | Notes |
| :- | :- | :- |
| `departure` / `arrival` | `string` | IATA code of an airport or city. Required. |
| `price` | `number` | The fare on offer. Required. |
| `baselinePrice` | `number` | What this route normally sells at — **this is what makes a fare hot**. |
| `currency` | `string` | ISO-4217 code, shown next to the price. |
| `departDate` / `returnDate` | `string` | `YYYY-MM-DD`. A `returnDate` makes it a round trip. |
| `airline` | `string` | Free text. |
| `directFlight` | `boolean` | Renders a "Direct" chip. |
| `label` | `string` | Short hook, e.g. "Long weekend in Lisbon". |
| `departureName` / `arrivalName` | `string` | Display names; falls back to the IATA code. |

**The heat scale** — no baseline, no invented heat:

| Discount vs. baseline | Heat | Chillies |
| :- | :- | :- |
| < 20% | `mild` | 🌶 |
| 20–34% | `medium` | 🌶🌶 |
| 35–49% | `hot` | 🌶🌶🌶 |
| 50%+ | `inferno` | 🌶🌶🌶🌶 |

SpicyTools never invents a bargain: if you do not tell it what the route usually costs, it will not
claim your fare is a steal.

## Configuration

| Option | Required | Type | Default | Description |
| :- | :- | :- | :- | :- |
| **rootElement** | **yes** | `HTMLElement` | — | Element the widget renders into. |
| **apiBase** | **yes** | `string` | — | Base URL of your fare API (autocomplete, availability, results). |
| spicyURL | — | `string` | — | **Deprecated** alias of `apiBase`; kept for existing embeds, `apiBase` wins when both are set. |
| fallbackSpicyURL | — | `string` | — | Fallback fare API used when the primary request fails. |
| webskyURL | — | `string` | — | Websky booking system URL (required in `WEBSKY` mode). |
| mode | — | `string` | `SPICY` | `SPICY` (SpicyTools fare API) or `WEBSKY`. |
| locale | — | `string` | `en` | `en`, `ru`, `de`, `it`, `nl`, `ro`, `kk`, `uz`, `uk`. |
| **hotDeals** | — | `HotDeal[]` | `[]` | Fares for the spice rack — see above. |
| hideDeals | — | `boolean` | `false` | Hide the rack even when `hotDeals` is set. |
| **onSearch** | — | `(info) => void` | — | Handle the search yourself instead of navigating to the results page. |
| verticalForm | — | `boolean` | `false` | Force the stacked layout. |
| defaultDepartureAirport | — | `string` \| `Airport` | — | IATA code or airport object. |
| defaultArrivalAirport | — | `string` \| `Airport` | — | IATA code or airport object. |
| defaultDepartureDate | — | `string` | — | `YYYY-MM-DD`. |
| defaultReturnDate | — | `string` | — | `YYYY-MM-DD`. |
| defaultPassengers | — | `object` | `{ ADT: 1 }` | e.g. `{ ADT: 2, CLD: 1 }`. |
| defaultServiceClass | — | `string` | `Economy` | `Economy` or `Business`. |
| directOnly | — | `boolean` | `false` | Search direct flights only. |
| vicinityDatesMode | — | `boolean` | `false` | Enable the "± N days" option. |
| vicinityDays | — | `number` | `3` | Size of the flexible-dates window. |
| highlightAvailableDates | — | `boolean` | `false` | Highlight dates that have flights. |
| disableUnavailableDates | — | `boolean` | `false` | Make dates without flights unselectable. |
| useNearestAirport | — | `boolean` | `false` | Pre-fill departure from the visitor's IP. |
| maxPassengersCount | — | `number` | `6` | Upper bound on the passenger counters. |
| readOnlyAutocomplete | — | `boolean` | `false` | Pick from a list instead of typing. |
| routingGrid | — | `string` | — | Two-letter airline IATA: restrict autocomplete to its route grid. |
| airportsBlackList | — | `string[]` | — | Hide airports/cities, e.g. `['MOW', 'LED']`. |
| arrivalSuggestions | — | `object` | — | Map of `"XXX-YYY"` → `{ suggestion, distance }`. |
| customAirportNames | — | `object` | — | Override airport names per locale. |
| customTranslations | — | `object` | — | Override any label, e.g. `{ en: { search: 'Go' } }`. |
| enableCoupon / enableMileCard | — | `boolean` | `false` | Extra fields (Websky mode). |
| isAWP | — | `boolean` | `false` | Avia Widget Pro result URLs. |
| openNewTab | — | `boolean` | `false` | Open results in a new tab. |
| disableCaching | — | `boolean` | `false` | Stop persisting the form in local storage. |
| utm | — | `object` | — | UTM params appended to the results URL. |

## Driving the widget from your own UI

```js
// Fill the form from a card, banner or agent response — no navigation needed if
// you also passed `onSearch`.
SpicyTools.applyDeal({ departure: 'CAI', arrival: 'IST', price: 118 });

// Re-enable local-storage caching after `disableCaching: true`.
SpicyTools.enableCache();
```

`onSearch` receives a normalised payload:

```js
SpicyTools.init({
  rootElement,
  apiBase,
  onSearch: (info) => {
    console.log(info.routeType, info.serviceClass, info.passengers, info.segments);
    // info.segments[0].departure.IATA, .departureDate (moment), .returnDate
  }
});
```

## Analytics

Every interaction dispatches a DOM event you can forward to GA, Meta Pixel, and friends:

```js
document.addEventListener('analytics.spicytools.search', (event) => {
  ga('send', { hitType: 'event', eventCategory: 'SpicyTools', eventAction: 'search', eventLabel: event.detail });
});
```

| Event | `detail` |
| :- | :- |
| `analytics.spicytools.search` | — a valid search was launched |
| `analytics.spicytools.deal.applied` | `"CAI-IST"` — a spice-rack fare was loaded |
| `analytics.spicytools.tripType.value` | `OW` / `RT` / `CR` |
| `analytics.spicytools.directFlights.active` | `true` / `false` |
| `analytics.spicytools.serviceClass.value` | `Economy` / `Business` |
| `analytics.spicytools.vicinityDates.active` | `true` / `false` |
| `analytics.spicytools.search.validationError` | error code — search attempted with an invalid form |

## Theming

The widget is painted entirely from SCSS tokens — no partial contains a raw colour. Override the
tokens before importing `main.scss`, or override the compiled CSS variables at runtime:

```scss
$ember: #ff0080;
$smoke-900: #0b0b12;

@import "spicytools/widget/src/css/main";
```

The default palette is **Smoke & Hot Sauce**: charcoal panels (`$smoke-900`), ember-red primary
(`$ember`), and a four-step heat scale (`$heat-mild` → `$heat-inferno`). See
[`src/css/_variables.scss`](./src/css/_variables.scss).

## Development

```bash
npm install          # from the repo root (npm workspaces)
npm run widget:dev   # webpack dev server on :9000, serving dist/
npm run build        # production bundle into dist/
npm test             # jest
```

An embed needs **either** `apiBase` **or** the deprecated `spicyURL` — `init()` validates both, so
the documented option works on its own. Without a reachable fare API the widget still mounts: the
spice rack and the search deep links are built in-page, and only autocomplete, the priced calendar
and award search come back empty.

The datepicker and select are upstream React ports consumed through `@spicytools/*` specifiers,
aliased to the published packages in `webpack.common.js` and `tsconfig.json` — swap the alias and
the whole widget moves with it.

## Renamed from `flights.search.widget`

This package started life as the Nemo `flights.search.widget`. Everything SpicyTools-owned has been
renamed; the table below is the migration map.

| Before | After |
| :- | :- |
| `FlightsSearchWidget.init()` | `SpicyTools.init()` |
| `FlightsSearchWidget.enableCache()` | `SpicyTools.enableCache()` |
| `nemoURL` / `fallbackNemoURL` | `spicyURL` / `fallbackSpicyURL` |
| `mode: 'NEMO'` | `mode: 'SPICY'` |
| `flights.search.widget.min.{js,css}` | `spicytools.min.{js,css}` |
| `analytics.searchForm.*` events | `analytics.spicytools.*` events |
