/* SpicyQuote master app — plain browser JS, no build step.
 *
 * Wires three things together:
 *   1. the search widget (packages/widget) — given the deal feed as its spice rack,
 *      with `onSearch` so the demo shows the payload instead of navigating away;
 *   2. the spice board — the same feed, filterable, and able to drive the widget
 *      through the `SpicyQuote.applyDeal()` hook;
 *   3. the MCP tool registry and dataset stats, read from this server.
 */

const RACK_SIZE = 4;            // how many deals the widget's own spice rack shows
const HEAT_LABEL = { mild: 'Mild', medium: 'Medium', hot: 'Hot', inferno: 'Inferno' };
const PEPPERS = { mild: '🌶', medium: '🌶🌶', hot: '🌶🌶🌶', inferno: '🌶🌶🌶🌶' };

const state = { deals: [], from: '', minHeat: '' };

const $ = (id) => document.getElementById(id);

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const money = (deal) => `${deal.currency ? `${deal.currency} ` : ''}${deal.price}`;

function dates(deal) {
  const fmt = (iso) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return deal.returnDate ? `${fmt(deal.departDate)} – ${fmt(deal.returnDate)}` : `${fmt(deal.departDate)} · one-way`;
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}


/* A SpicyQuote deep link from the BCF widget (?origin=CAI&destination=JFK&date=…)
 * lands here: load the route straight into the widget so the agent can price it
 * in our engine without retyping anything. */
function applyDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const origin = (params.get('origin') || '').toUpperCase();
  const destination = (params.get('destination') || '').toUpperCase();

  if (!origin || !destination) return;

  const cabin = params.get('cabin') || 'economy';
  const deal = {
    id: `deep-link-${origin}-${destination}`,
    departure: origin,
    arrival: destination,
    departDate: params.get('date') || nextMonth(),
    label: `From BCF: ${origin} → ${destination}`,
    cabin: { economy: 'Y', premium: 'W', business: 'B', first: 'F' }[cabin] || 'Y',
    adults: Number(params.get('passengers')) || 1
  };

  window.SpicyQuote.applyDeal(deal);
  document.getElementById('search').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function nextMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/* --- Spice board --------------------------------------------------------- */

function cardHTML(deal) {
  return `
    <article class="card card_${deal.heat}">
      <div class="card__top">
        <span class="card__route">${esc(deal.departure)} → ${esc(deal.arrival)}</span>
        <span class="card__price">
          ${esc(money(deal))}
          ${deal.baselinePrice ? `<span class="card__was">${esc(deal.currency ? `${deal.currency} ` : '')}${esc(deal.baselinePrice)}</span>` : ''}
        </span>
      </div>

      <p class="card__label">${esc(deal.label || '')}</p>

      <div class="card__meta">
        <span class="card__chip">${esc(dates(deal))}</span>
        ${deal.directFlight ? '<span class="card__chip">Direct</span>' : ''}
        ${deal.airline ? `<span class="card__chip">${esc(deal.airline)}</span>` : ''}
      </div>

      <div class="card__links">${linkHTML(deal)}</div>

      <div class="card__foot">
        <span class="heat heat_${deal.heat}">
          ${PEPPERS[deal.heat]} ${HEAT_LABEL[deal.heat]}
          ${deal.discountPercent > 0 ? `<span class="off">−${deal.discountPercent}%</span>` : ''}
        </span>
        <button class="btn" type="button" data-deal="${esc(deal.id)}">Load &amp; search</button>
      </div>
    </article>`;
}

/* The BCF floating widget opens a lead in these places; the spice board does
 * the same for every fare. Links are built server-side from
 * packages/bcf-widget/src/flight-links.js and shipped with the feed. */
const LINK_LABELS = [
  ['kayak', 'Kayak'],
  ['google', 'Google Flights'],
  ['matrix', 'ITA Matrix'],
  ['pointsYeah', 'PointsYeah']
];

function linkHTML(deal) {
  const links = deal.links || {};
  const anchors = LINK_LABELS.filter(([key]) => links[key])
    .map(
      ([key, label]) =>
        `<a class="card__link" href="${esc(links[key])}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`
    )
    .join('');

  const copy = links.fastSearch
    ? `<button class="card__link" type="button" data-copy="${esc(links.fastSearch)}" title="${esc(links.fastSearch)}">Copy GK</button>`
    : '';

  return anchors + copy;
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    button.classList.add('card__link-copied');
    const was = button.textContent;
    button.textContent = 'Copied ✓';
    setTimeout(() => {
      button.classList.remove('card__link-copied');
      button.textContent = was;
    }, 1400);
  } catch (err) {
    button.textContent = 'Copy failed';
  }
}

function renderBoard() {
  const order = ['mild', 'medium', 'hot', 'inferno'];
  const deals = state.deals
    .filter((deal) => !state.from || deal.departure === state.from)
    .filter((deal) => !state.minHeat || order.indexOf(deal.heat) >= order.indexOf(state.minHeat))
    .sort((a, b) => order.indexOf(b.heat) - order.indexOf(a.heat) || a.price - b.price);

  $('board-grid').innerHTML = deals.length
    ? deals.map(cardHTML).join('')
    : '<p class="empty">No fares match those filters — loosen them up.</p>';

  $('board-count').textContent = `${deals.length} fare${deals.length === 1 ? '' : 's'}`;

  $('board-grid')
    .querySelectorAll('button[data-deal]')
    .forEach((button) =>
      button.addEventListener('click', () => {
        const deal = state.deals.find((item) => item.id === button.dataset.deal);

        // Hand the fare to the widget: it fills the form and runs the search,
        // which lands in our `onSearch` handler instead of leaving the page.
        window.SpicyQuote.applyDeal(deal);
        document.getElementById('search').scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
    );

  $('board-grid')
    .querySelectorAll('button[data-copy]')
    .forEach((button) => button.addEventListener('click', () => copyText(button.dataset.copy, button)));
}

/* --- Agent tools + datasets ---------------------------------------------- */

function renderTools(tools) {
  $('tools-grid').innerHTML = tools
    .map(
      (tool) => `
      <div class="tool">
        <div class="tool__head">
          <span class="tool__name">${esc(tool.name)}</span>
          <span class="tool__badge">${tool.local ? 'local · unlimited' : 'metered'}</span>
        </div>
        <p class="tool__desc">${esc(tool.description.split('. ')[0])}.</p>
      </div>`
    )
    .join('');

  $('stat-tools').textContent = tools.length;
}

function renderDatasets(datasets) {
  $('datasets').innerHTML = datasets
    .map(
      (dataset) => `
      <div class="dataset">
        <div class="dataset__name">${esc(dataset.name)}</div>
        <div class="dataset__meta">${dataset.records} records in ${dataset.sections.length} sections · ${esc(dataset.sections.join(', '))}</div>
        <div class="dataset__meta">updated ${esc(dataset.lastUpdated || '—')}</div>
      </div>`
    )
    .join('');

  $('stat-data').textContent = datasets.length;
}

/* --- Boot ---------------------------------------------------------------- */

async function boot() {
  const [dealsPayload, toolsPayload, datasetsPayload] = await Promise.all([
    getJSON('/api/deals?links=1'),
    getJSON('/api/tools'),
    getJSON('/api/datasets'),
  ]);

  state.deals = dealsPayload.deals;
  $('stat-deals').textContent = dealsPayload.count;
  $('board-disclaimer').textContent = dealsPayload.disclaimer || '';

  const origins = Array.from(new Set(state.deals.map((deal) => deal.departure))).sort();
  $('filter-from').innerHTML =
    '<option value="">Anywhere</option>' + origins.map((code) => `<option value="${esc(code)}">${esc(code)}</option>`).join('');

  renderBoard();
  renderTools(toolsPayload.tools);
  renderDatasets(datasetsPayload.datasets);

  $('copy-bcf').addEventListener('click', () =>
    copyText(new URL('/bcf-widget.user.js', window.location.href).href, $('copy-bcf'))
  );

  applyDeepLink();

  // The widget: same feed, top fares only, search handled in-page.
  window.SpicyQuote.init({
    rootElement: $('search-root'),
    // The SpicyTool-shaped API this very server exposes (see server.mjs).
    // Point `apiBase` at `https://your-spicytool-host` to use a real backend.
    apiBase: window.location.origin,
    locale: 'en',
    mode: 'SPICY',
    highlightAvailableDates: true,
    hotDeals: state.deals.slice(0, RACK_SIZE),
    onSearch: (searchInfo) => {
      const payload = $('search-payload');
      $('search-payload-body').textContent = JSON.stringify(
        {
          routeType: searchInfo.routeType,
          passengers: searchInfo.passengers,
          serviceClass: searchInfo.serviceClass,
          segments: searchInfo.segments.map((segment) => ({
            from: segment.departure.IATA,
            to: segment.arrival.IATA,
            depart: segment.departureDate.format('YYYY-MM-DD'),
            ret: segment.returnDate ? segment.returnDate.format('YYYY-MM-DD') : null,
          })),
        },
        null,
        2
      );
      payload.hidden = false;
    },
  });
}

$('filter-from').addEventListener('change', (event) => {
  state.from = event.target.value;
  renderBoard();
});

$('filter-heat').addEventListener('change', (event) => {
  state.minHeat = event.target.value;
  renderBoard();
});

$('copy-endpoint').addEventListener('click', async (event) => {
  const url = new URL('/mcp', window.location.href).toString();
  try {
    await navigator.clipboard.writeText(url);
    event.target.textContent = 'Copied';
  } catch {
    event.target.textContent = url;
  }
  setTimeout(() => (event.target.textContent = 'Copy'), 2000);
});

$('mcp-endpoint').textContent = new URL('/mcp', window.location.href).toString();

boot().catch((err) => {
  console.error(err);
  $('board-grid').innerHTML = `<p class="empty">Could not load the deal feed: ${esc(err.message)}</p>`;
});
