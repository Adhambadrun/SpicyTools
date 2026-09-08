// Tests for the BCF link builders: the URLs are the product here, so they are
// pinned exactly. Run with `npm test --workspace @spicytools/bcf-widget`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const links = require('../src/flight-links.js');

const ROUND_TRIP = {
	id: '123456',
	name: 'Hany Hassan',
	origin: 'CAI',
	destination: 'JFK',
	cabin: 'B',
	departureDate: '2026-09-15',
	returnDate: '2026-09-29',
	adults: 2,
	children: 1,
	infants: 0
};

const ONE_WAY = {
	...ROUND_TRIP,
	returnDate: null,
	isOneWay: true,
	adults: 1,
	children: 0
};

const MULTI = {
	...ROUND_TRIP,
	segments: [
		{ origin: 'CAI', destination: 'JFK', departureDate: '2026-09-15', returnDate: null },
		{ origin: 'LHR', destination: 'CAI', departureDate: '2026-09-29', returnDate: null }
	]
};

test('Kayak: round trip carries cabin, passengers and the sort', () => {
	const url = links.buildKayakUrl(ROUND_TRIP, 0);

	assert.equal(
		url,
		'https://www.kayak.com/flights/CAI-JFK/2026-09-15/2026-09-29/business/2adults/children-8?sort=bestflight_a'
	);
});

test('Kayak: flex days become a flexible date range', () => {
	const url = links.buildKayakUrl(ONE_WAY, 3);

	assert.equal(url, 'https://www.kayak.com/flights/CAI-JFK/2026-09-15-flexible-3days/business/1adults?sort=bestflight_a');
});

test('Kayak: cabin override wins over the lead cabin', () => {
	assert.match(links.buildKayakUrl(ROUND_TRIP, 0, 'F'), /\/first\/2adults/);
});

test('Google Flights: link is a base64url protobuf and decodes back to the trip', () => {
	const url = links.buildGoogleFlightsUrl(ROUND_TRIP, false);
	const tfs = new URL(url).searchParams.get('tfs');

	assert.match(url, /^https:\/\/www\.google\.com\/travel\/flights\?tfs=[A-Za-z0-9_-]+&hl=en&curr=USD$/);

	const bytes = Buffer.from(tfs.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
	const text = bytes.toString('latin1');

	assert.ok(text.includes('2026-09-15'), 'departure date is encoded');
	assert.ok(text.includes('2026-09-29'), 'return date is encoded');
	assert.ok(text.includes('CAI') && text.includes('JFK'), 'airports are encoded');
	assert.equal(url.includes('+'), false, 'base64url, not raw base64');
});

test('Google Flights: the ELR variant appends a YVR leg', () => {
	const plain = links.buildGoogleFlightsUrl(ONE_WAY, false);
	const elr = links.buildGoogleFlightsUrl(ONE_WAY, true);

	assert.notEqual(plain, elr);
	assert.ok(elr.length > plain.length);
	assert.ok(Buffer.from(new URL(elr).searchParams.get('tfs'), 'base64').toString('latin1').includes('YVR'));
});

test('ITA Matrix: payload round-trips through base64 JSON', () => {
	const url = links.buildMatrixUrl(ROUND_TRIP, null, null, null, 0);
	const payload = JSON.parse(Buffer.from(new URL(url).searchParams.get('search'), 'base64').toString('utf8'));

	assert.equal(url.startsWith('https://matrix.itasoftware.com/search?search='), true);
	assert.equal(payload.type, 'round-trip');
	assert.equal(payload.options.cabin, 'BUSINESS');
	assert.equal(payload.pax.adults, '2');
	assert.equal(payload.pax.children, '1');
	assert.equal(payload.slices[0].origin[0], 'CAI');
	assert.equal(payload.slices[0].dates.departureDate, '2026-09-15');
	assert.equal(payload.slices[0].dates.returnDate, '2026-09-29');
});

test('ITA Matrix: multi-city and mixed cabins', () => {
	const payload = JSON.parse(
		Buffer.from(new URL(links.buildMatrixUrl(MULTI, null, 'B', 'Y', 2)).searchParams.get('search'), 'base64').toString('utf8')
	);

	assert.equal(payload.type, 'multi-city');
	assert.equal(payload.slices.length, 2);
	assert.equal(payload.slices[0].dates.departureDateModifier, '22');
	assert.match(payload.slices[0].ext, /cabin/);
});

test('PointsYeah: one leg at a time, expanded by the flex window', () => {
	const leg = { label: 'Depart', origin: 'CAI', destination: 'JFK', date: '2026-09-15' };
	const url = links.buildPointsYeahUrl(ROUND_TRIP, leg, 3);
	const params = new URL(url).searchParams;

	assert.equal(url.startsWith('https://www.pointsyeah.com/search?'), true);
	assert.equal(params.get('cabin'), 'Business');
	assert.equal(params.get('departure'), 'CAI');
	assert.equal(params.get('departDate'), '2026-09-12');
	assert.equal(params.get('departDateSec'), '2026-09-18');
	assert.equal(params.get('multiday'), 'true');
	assert.equal(params.get('adults'), '2');
});

test('PointsYeah: a leg without a date yields no link', () => {
	assert.equal(links.buildPointsYeahUrl(ROUND_TRIP, { origin: 'CAI', destination: 'JFK' }, 0), null);
});

test('SpicyTools: deep link uses the SpicyTool search query shape', () => {
	const leg = { origin: 'CAI', destination: 'JFK', date: '2026-09-15' };
	const url = links.buildSpicyToolsUrl(ROUND_TRIP, leg);
	const params = new URL(url).searchParams;

	assert.equal(params.get('origin'), 'CAI');
	assert.equal(params.get('destination'), 'JFK');
	assert.equal(params.get('date'), '2026-09-15');
	assert.equal(params.get('cabin'), 'business');
	assert.equal(params.get('passengers'), '3');
	assert.equal(url.includes('agentsearch') || url.includes('flybasis'), false);
});

test('Fast Search: Sabre command with ARNK for a broken multi-city route', () => {
	assert.equal(links.buildFastSearchCommand(ROUND_TRIP), 'JR.CAI/S-OCJFK15SEP/S-OCCAI29SEP');
	assert.equal(links.buildFastSearchCommand(MULTI), 'JR.CAI/S-OCJFK15SEP/S-ARUNKLHR/S-OCCAI29SEP');
	assert.equal(links.buildFastSearchCommand(ONE_WAY), 'JR.CAI/S-OCJFK15SEP');
});

test('Fast Search: cabin override maps to the Sabre booking class', () => {
	assert.equal(links.buildFastSearchCommand(ROUND_TRIP, 'Y'), 'JR.CAI/S-OYJFK15SEP/S-OYCAI29SEP');
	assert.equal(links.getFastSearchCabin('W'), 'S');
	assert.equal(links.getFastSearchCabin('F'), 'F');
});

test('helpers: dates, seasons and trip labels', () => {
	assert.equal(links.addDays('2026-09-15', 3), '2026-09-18');
	assert.equal(links.daysBetween('2026-09-15', '2026-09-29'), 14);
	assert.equal(links.fmtDate('2026-09-15'), '15 Sep 26');
	assert.equal(links.seasonInfo('2026-07-01').label, 'Peak season');
	assert.equal(links.seasonInfo('2026-01-05').label, 'Off-peak season');
	assert.equal(links.tripTypeLabel(ROUND_TRIP), 'Round trip');
	assert.equal(links.tripTypeLabel(ONE_WAY), 'One way');
	assert.equal(links.tripTypeLabel(MULTI), 'Multi-city - 2 legs');
	assert.equal(links.isOpenJaw(MULTI.segments), true);
	assert.equal(links.cabinLabel('B'), 'Business');
	assert.equal(links.searchLegs(ROUND_TRIP).length, 2);
});
