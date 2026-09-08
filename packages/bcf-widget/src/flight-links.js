// packages/bcf-widget/src/flight-links.js
//
// Pure, dependency-free builders for every "take this itinerary elsewhere"
// link the BCF Floating Flight Search Widget can open:
//
//   buildKayakUrl(lead, flexDays, overrideCabin)
//   buildGoogleFlightsUrl(lead, addYvr, overrideCabin)   // protobuf `tfs` payload
//   buildMatrixUrl(lead, overrideCabin, mixedDep, mixedRet, flexDays)
//   buildPointsYeahUrl(lead, leg, flexDays, overrideCabin)
//   buildSpicyQuoteUrl(lead, leg, overrideCabin)         // our own engine
//   buildFastSearchCommand(lead, overrideCabin)          // Sabre / GK command
//
// A `lead` is the shape the widget detects (and the shape SpicyQuote deals
// already use):
//   { id, name, origin, destination, cabin, departureDate, returnDate,
//     adults, children, infants, segments: [{ origin, destination,
//                                            departureDate, returnDate }] }
//
// Ported from the TBC Floating Flight Search Widget (v12.2) and re-skinned to
// the SpicyQuote "dark smoke & hot sauce" palette. `npm run build` inlines this
// file into the userscript, so keep it free of DOM access.

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function cabinLabel(letter) {
    return { Y:'Economy', W:'Premium Economy', B:'Business', F:'First' }[letter] || 'Economy';
  }

  function seasonInfo(dateStr) {
    if (!dateStr) return { label:'', cls:'' };
    const month = parseInt(dateStr.slice(5, 7), 10);
    if ([6,7,8,12].includes(month)) return { label:'Peak season', cls:'fx-season-peak' };
    if ([3,4,5,9,10,11].includes(month)) return { label:'Shoulder season', cls:'fx-season-shoulder' };
    return { label:'Off-peak season', cls:'fx-season-off' };
  }

  function daysBetween(a, b) {
    return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
  }

  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function fmtDate(d) {
    if (!d) return '?';
    const p = d.split('-');
    return p[2] + ' ' + MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0].slice(2);
  }

  function isOpenJaw(segments) {
    if (!segments || segments.length < 2) return false;
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].origin !== segments[i - 1].destination) return true;
    }
    return segments[segments.length - 1].destination !== segments[0].origin;
  }

  function leadSegments(lead) {
    return (lead.segments && lead.segments.length) ? lead.segments : [{
      origin: lead.origin, destination: lead.destination,
      departureDate: lead.departureDate, returnDate: lead.returnDate
    }];
  }

  function tripTypeLabel(lead) {
    const segs = leadSegments(lead);
    if (segs.length > 1) return (lead.isOpenJaw ? 'Open jaw' : 'Multi-city') + ' - ' + segs.length + ' legs';
    if (lead.isMultiCity) return 'Multi-city';
    if (segs[0] && segs[0].returnDate) return 'Round trip';
    return 'One way';
  }

  function searchLegs(lead) {
    const segs = leadSegments(lead);
    if (segs.length === 1) {
      const s = segs[0];
      const legs = [{ label:'Depart', origin:s.origin, destination:s.destination, date:s.departureDate }];
      if (s.returnDate) {
        legs.push({ label:'Return', origin:s.destination, destination:s.origin, date:s.returnDate });
      }
      return legs;
    }
    return segs.map((s, i) => ({
      label: 'Leg ' + (i + 1), origin: s.origin, destination: s.destination, date: s.departureDate
    }));
  }

  function buildKayakUrl(lead, flexDays, overrideCabin) {
    const cLetter = overrideCabin || lead.cabin;
    const cabin = { Y:'economy', W:'premium', B:'business', F:'first' }[cLetter] || 'business';
    const segs = leadSegments(lead);
    const flex = d => (d && flexDays > 0) ? d + '-flexible-' + flexDays + 'days' : d;
    let path;
    if (segs.length === 1) {
      const s = segs[0];
      path = '/flights/' + s.origin + '-' + s.destination + '/' + flex(s.departureDate);
      if (s.returnDate) path += '/' + flex(s.returnDate);
    } else {
      path = '/flights/' + segs.map(s => s.origin + '-' + s.destination + '/' + flex(s.departureDate)).join('/');
    }
    path += '/' + cabin + '/' + lead.adults + 'adults';
    const tokens = [];
    for (let i = 0; i < lead.infants; i++) tokens.push('1L');
    for (let i = 0; i < lead.children; i++) tokens.push('8');
    if (tokens.length) path += '/children-' + tokens.join('-');
    return 'https://www.kayak.com' + path + '?sort=bestflight_a';
  }

  function pbVarint(n) {
    const out = [];
    while (n > 127) { out.push((n & 0x7f) | 0x80); n >>>= 7; }
    out.push(n);
    return out;
  }

  function pbTag(field, wire) { return pbVarint((field << 3) | wire); }

  function pbString(field, value) {
    const bytes = Array.from(new TextEncoder().encode(value));
    return [...pbTag(field, 2), ...pbVarint(bytes.length), ...bytes];
  }

  function pbMessage(field, bytes) {
    return [...pbTag(field, 2), ...pbVarint(bytes.length), ...bytes];
  }

  function pbNumber(field, value) { return [...pbTag(field, 0), ...pbVarint(value)]; }

  function buildGoogleFlightsUrl(lead, addYvr, overrideCabin) {
    let legs = searchLegs(lead).filter(l => l.date && l.origin && l.destination);
    if (!legs.length) return 'https://www.google.com/travel/flights';

    let tripType = 1;
    if (addYvr) {
      const lastLeg = legs[legs.length - 1];
      const elrDate = addDays(lastLeg.date, 1);
      const depOrigin = legs[0].origin;
      legs.push({ label: 'ELR Extra', origin: depOrigin, destination: 'YVR', date: elrDate });
      tripType = 3;
    } else {
      const segs = leadSegments(lead);
      tripType = segs.length > 1 ? 3 : (segs[0].returnDate ? 1 : 2);
    }
    const cLetter = overrideCabin || lead.cabin;
    const seat = { Y:1, W:2, B:3, F:4 }[cLetter] || 3;
    let body = [];
    legs.forEach(l => {
      body = body.concat(pbMessage(3, [].concat(
        pbString(2, l.date),
        pbMessage(13, pbString(2, l.origin)),
        pbMessage(14, pbString(2, l.destination))
      )));
    });
    for (let i = 0; i < lead.adults; i++)   body = body.concat(pbNumber(8, 1));
    for (let i = 0; i < lead.children; i++) body = body.concat(pbNumber(8, 2));
    for (let i = 0; i < lead.infants; i++)  body = body.concat(pbNumber(8, 4));
    body = body.concat(pbNumber(9, seat));
    body = body.concat(pbNumber(19, tripType));
    const tfs = btoa(String.fromCharCode.apply(null, body))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return 'https://www.google.com/travel/flights?tfs=' + tfs + '&hl=en&curr=USD';
  }

  function itaDateModifier(flexDays) {
    const n = Math.min(Math.max(parseInt(flexDays, 10) || 0, 0), 2);
    return String(n) + String(n);
  }

  const ITA_EXT_CABIN = { B:'2', W:'premium-coach', F:'1', Y:'3' };

  function buildMatrixUrl(lead, overrideCabin, mixedDep, mixedRet, flexDays) {
    const cabinMap = { Y:'COACH', W:'PREMIUM-COACH', B:'BUSINESS', F:'FIRST' };
    const segs    = leadSegments(lead);
    const isMulti = segs.length > 1;
    const isRT    = !isMulti && !!segs[0].returnDate;
    const mod     = itaDateModifier(flexDays);

    const pax = { adults: String(lead.adults) };
    if (lead.children > 0) pax.children    = String(lead.children);
    if (lead.infants  > 0) pax.infantInLap = String(lead.infants);

    const itaSlices = [];

    if (isMulti) {
      segs.forEach((s, i) => {
        const isLastLeg = (i === segs.length - 1);
        const legMix = isLastLeg ? (mixedRet || mixedDep) : (mixedDep || mixedRet);
        const legExt = legMix ? ('+cabin ' + (ITA_EXT_CABIN[legMix] || '2')) : '';
        itaSlices.push({
          origin: [s.origin], dest: [s.destination], routing: '', ext: legExt,
          dates: {
            searchDateType: 'specific',
            departureDate: s.departureDate,
            departureDateType: 'depart',
            departureDateModifier: mod,
            departureDatePreferredTimes: []
          }
        });
      });
    } else {
      const s = segs[0];
      const depExt = mixedDep ? ('+cabin ' + (ITA_EXT_CABIN[mixedDep] || '2')) : '';
      const retExt = mixedRet ? ('+cabin ' + (ITA_EXT_CABIN[mixedRet] || '2')) : '';

      const dates = {
        searchDateType: 'specific',
        departureDate: s.departureDate,
        departureDateType: 'depart',
        departureDateModifier: mod,
        departureDatePreferredTimes: []
      };
      if (s.returnDate) {
        dates.returnDate               = s.returnDate;
        dates.returnDateType           = 'depart';
        dates.returnDateModifier       = mod;
        dates.returnDatePreferredTimes = [];
      }

      itaSlices.push({
        origin: [s.origin], dest: [s.destination],
        routing: '',    ext:    depExt,
        routingRet: '', extRet: s.returnDate ? retExt : '',
        dates
      });
    }

    const payload = {
      type: isMulti ? 'multi-city' : (isRT ? 'round-trip' : 'one-way'),
      slices: itaSlices,
      options: {
        cabin: (mixedDep || mixedRet)
          ? 'COACH'
          : (cabinMap[overrideCabin || lead.cabin] || 'BUSINESS'),
        stops: '-1', extraStops: '1',
        allowAirportChanges: 'true', showOnlyAvailable: 'true'
      },
      pax
    };
    return 'https://matrix.itasoftware.com/search?search=' + encodeURIComponent(btoa(JSON.stringify(payload)));
  }

  const PY_BANKS = 'Amex,Bilt,Capital One,Chase,Citi,WF';

  const PY_PROGRAMS = 'AR,AM,AC,KL,AS,AA,AV,DL,EY,AY,B6,LH,QF,SK,TK,UA,VS,VA';

  function buildPointsYeahUrl(lead, leg, flexDays, overrideCabin) {
    if (!leg || !leg.date || !leg.origin || !leg.destination) return null;
    const cabinName = cabinLabel(overrideCabin || lead.cabin);
    let departDate = leg.date, departDateSec = leg.date, multiday = false;
    if (flexDays > 0) {
      departDate = addDays(leg.date, -flexDays);
      departDateSec = addDays(leg.date, flexDays);
      multiday = true;
    }
    const params = new URLSearchParams({
      cabins: cabinName, cabin: cabinName, banks: PY_BANKS, airlineProgram: PY_PROGRAMS,
      tripType: '1', adults: String(lead.adults), children: String(lead.children),
      departure: leg.origin, arrival: leg.destination, departDate, departDateSec, multiday: String(multiday)
    });
    return 'https://www.pointsyeah.com/search?' + params.toString();
  }

  // Where SpicyQuote deep links land. A deployment overrides this once at boot
  // with `BCF.setSearchBase('https://your-spicyquote-host')`.
  let SPICYQUOTE_SEARCH_BASE = 'https://search.spicyquote.app';

  function setSearchBase(url) {
    if (url) SPICYQUOTE_SEARCH_BASE = String(url).replace(/\/$/, '');
    return SPICYQUOTE_SEARCH_BASE;
  }
  const SPICYQUOTE_CABINS = { Y: 'economy', W: 'premium', B: 'business', F: 'first' };

  /**
   * Deep link into SpicyQuote: the same SpicyTool query shape the widget uses
   * (`/api/v2/search`), so a BCF lead can be priced by our own engine.
   */
  function buildSpicyQuoteUrl(lead, leg, overrideCabin) {
    if (!leg || !leg.date || !leg.origin || !leg.destination) return null;

    const params = new URLSearchParams({
      origin: leg.origin,
      destination: leg.destination,
      date: leg.date,
      cabin: SPICYQUOTE_CABINS[overrideCabin || lead.cabin] || 'business',
      passengers: String(lead.adults + lead.children)
    });

    return SPICYQUOTE_SEARCH_BASE + '/?' + params.toString();
  }

  function getFastSearchCabin(cabinLetter) {
    return { B: 'C', W: 'S', Y: 'Y', F: 'F' }[cabinLetter] || 'Y';
  }

  function formatSabreDate(dateStr) {
    if (!dateStr) return '';
    const p = dateStr.split('-');
    if (p.length !== 3) return '';
    return parseInt(p[2], 10) + MONTHS[parseInt(p[1], 10) - 1].toUpperCase();
  }

  function buildFastSearchCommand(lead, overrideCabin) {
    const segs = leadSegments(lead);
    if (!segs || !segs.length) return '';
    const cab = getFastSearchCabin(overrideCabin || lead.cabin);
    const mod = '/S-O' + cab;

    let cmd = 'JR.' + segs[0].origin;

    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];

      // If it's multi-city and there's a gap in the route, insert ARNK
      if (i > 0) {
        const prevDest = segs[i - 1].destination;
        if (s.origin !== prevDest) {
          cmd += '/S-ARUNK' + s.origin;
        }
      }

      // Add the flight segment
      cmd += mod + s.destination + formatSabreDate(s.departureDate);

      // If it's a simple 1-segment round trip (handled via returnDate)
      if (i === 0 && segs.length === 1 && s.returnDate) {
        cmd += mod + s.origin + formatSabreDate(s.returnDate);
      }
    }
    return cmd;
  }
// --- Node surface (skipped when inlined into the userscript) ----------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MONTHS, cabinLabel, seasonInfo, daysBetween, addDays, fmtDate,
    leadSegments, isOpenJaw, searchLegs, tripTypeLabel,
    buildKayakUrl, buildGoogleFlightsUrl, buildMatrixUrl, buildPointsYeahUrl,
    buildSpicyQuoteUrl, buildFastSearchCommand, setSearchBase,
    getFastSearchCabin, formatSabreDate, itaDateModifier, SPICYQUOTE_CABINS
  };
}
