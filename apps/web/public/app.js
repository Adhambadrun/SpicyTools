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

      <div class="card__foot">
        <span class="heat heat_${deal.heat}">
          ${PEPPERS[deal.heat]} ${HEAT_LABEL[deal.heat]}
          ${deal.discountPercent > 0 ? `<span class="off">−${deal.discountPercent}%</span>` : ''}
        </span>
        <button class="btn" type="button" data-deal="${esc(deal.id)}">Load &amp; search</button>
      </div>
    </article>`;
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
    getJSON('/api/deals'),
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

  // The widget: same feed, top fares only, search handled in-page.
  window.SpicyQuote.init({
    rootElement: $('search-root'),
    spicyURL: 'https://geodata.nemo.travel',
    fallbackSpicyURL: 'https://sys.nemo.travel',
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
