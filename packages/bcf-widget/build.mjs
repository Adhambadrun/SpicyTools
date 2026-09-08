// packages/bcf-widget/build.mjs — assemble the userscript from src/.
//
// The widget is authored as two files so the URL builders can also be used
// from Node (the SpicyQuote site renders the same links for its deals), but a
// userscript has to be a single self-contained file, so we concatenate:
//
//   src/flight-links.js  (pure builders, no DOM)
//   src/widget.js        (STYLE + panel + embedded tools + init)
//
// and wrap them in one IIFE behind the `==UserScript==` header.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const HEADER = `// ==UserScript==
// @name         BCF Floating Flight Search Widget
// @namespace    bcf-flight-widget
// @version      1.0.0
// @description  Floating flight search helper for Bo.BCFlights.com — lead detection, Kayak / Google Flights / ITA Matrix / PointsYeah / SpicyQuote links, Sabre Fast Search, VIP itinerary maker, GK converter and PNR tools. Powered by SpicyQuote.
// @match        https://bo.bcflights.com/*
// @grant        none
// ==/UserScript==
//
// BCF Floating Flight Search Widget — part of SpicyQuote.
//
// Ported from the TBC Floating Flight Search Widget (v12.2). Every reference
// to TBC / bo.travelbusinessclass.com has been replaced with BCF /
// bo.bcflights.com, the flybasis leg button now opens SpicyQuote, and the
// palette is SpicyQuote's "dark smoke & hot sauce".
//
// Source (edit these, then \`npm run build\`):
//   packages/bcf-widget/src/flight-links.js
//   packages/bcf-widget/src/widget.js
`;

const read = (name) => readFile(resolve(HERE, 'src', name), 'utf8');

const [links, widget] = await Promise.all([read('flight-links.js'), read('widget.js')]);

const banner = (text) => `\n  /* ---------------------------------------------------------------------\n     ${text}\n     --------------------------------------------------------------------- */\n`;

const out = `${HEADER}
(function () {
  'use strict';

  // Detected lead + the cards on screen, shared by the panel and its tools.
  const FX = { currentLead: null, allCards: [] };
${banner('flight-links.js — pure URL builders (no DOM)')}
${links.replace(/if \(typeof module[\s\S]*$/m, '')}
${banner('widget.js — the floating panel, lead detection and embedded tools')}
${widget}

  // Let the host page (and SpicyQuote itself) reuse the builders.
  window.BCF = {
    version: '1.0.0',
    get currentLead() { return FX.currentLead; },
    buildKayakUrl,
    buildGoogleFlightsUrl,
    buildMatrixUrl,
    buildPointsYeahUrl,
    buildSpicyQuoteUrl,
    setSearchBase,
    buildFastSearchCommand,
    cabinLabel,
    searchLegs,
    tripTypeLabel,
    detectCurrentLead
  };
})();
`;

await mkdir(resolve(HERE, 'dist'), { recursive: true });
await writeFile(resolve(HERE, 'dist/bcf-floating-flight-search-widget.user.js'), out);

console.log(`built dist/bcf-floating-flight-search-widget.user.js (${out.length} bytes)`);
