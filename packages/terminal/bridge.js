/* --------------------------------------------------------------------------
   bridge.js — SpicyTools wiring for the Terminal page (ours, not upstream's).

   Two small additions on top of the vendored app:
     1. a slim SpicyTools bar so the page reads as part of the master tool;
     2. a "Booking links →" button that hands the GDS output to SpicyTools
        Link, which turns it into AA / United / Delta / BA / Google / ITA
        links and BookWithMatrix JSON.
   -------------------------------------------------------------------------- */

(function () {
  'use strict';

  var CHANNEL = 'spicytools.itinerary';

  function bar() {
    var el = document.createElement('div');
    el.id = 'spicytools-bar';
    el.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9999',
      'display:flex', 'align-items:center', 'gap:10px',
      'padding:8px 14px', 'font:600 12px/1.2 Inter, Helvetica, Arial, sans-serif',
      'background:linear-gradient(90deg,#141110,#201c1a)',
      'border-bottom:1px solid #2b2b3a', 'color:#f6efe9'
    ].join(';');

    var brand = document.createElement('a');
    brand.href = '/';
    brand.textContent = 'SpicyTools';
    brand.style.cssText = 'color:#ff8a00;text-decoration:none;font-weight:800;letter-spacing:.02em';

    var what = document.createElement('span');
    what.textContent = 'Terminal';
    what.style.cssText = 'color:#a99b91;font-weight:600';

    var spacer = document.createElement('span');
    spacer.style.flex = '1';

    var send = document.createElement('button');
    send.id = 'spicytools-to-link';
    send.type = 'button';
    send.textContent = 'Booking links →';
    send.style.cssText = [
      'border:1px solid #ff5c2b', 'background:rgba(255,92,43,.12)', 'color:#ffb08a',
      'border-radius:999px', 'padding:5px 12px', 'font:inherit', 'font-weight:700', 'cursor:pointer'
    ].join(';');
    send.addEventListener('click', handoff);

    el.appendChild(brand);
    el.appendChild(what);
    el.appendChild(spacer);
    el.appendChild(send);
    document.body.appendChild(el);
    document.body.style.paddingTop = '38px';
  }

  function handoff() {
    var out = document.getElementById('out');
    var text = out ? (out.textContent || '').trim() : '';

    if (!text) {
      send.textContent = 'Convert something first';
      setTimeout(function () { send.textContent = 'Booking links →'; }, 1800);
      return;
    }

    try {
      sessionStorage.setItem(CHANNEL, text);
    } catch (e) {
      // Private mode or a blocked store: the itinerary is short, so a query
      // string is an acceptable fallback.
      window.location.href = '/link/app.html?gds=' + encodeURIComponent(text);
      return;
    }

    window.location.href = '/link/app.html';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bar);
  } else {
    bar();
  }

  // SpicyTools Link also accepts ?gds= when sessionStorage is unavailable.
  window.SpicyToolsTerminal = { handoff: handoff };
})();
