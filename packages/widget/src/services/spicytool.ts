import { Airport } from './models/Airport';
import { AutocompleteSuggestion } from './models/AutocompleteSuggestion';
import { AvailableDateResponse } from './responses/AvailableDates';
import { AirportNamesPool, Language } from '../state';
import { URL } from '../utils';
import { HEAT_LEVELS, HotDeal } from '../deals';

/**
 * SpicyTool API client — the interface SpicyQuote speaks.
 *
 * SpicyTool (packages/spicytool) is the award-search engine: it owns the
 * airport dataset, the fare calendar and the provider aggregation. This module
 * is the whole contract as far as the widget is concerned — every network call
 * the widget makes in `SPICY` mode goes through one of these builders, and
 * every response is mapped onto the widget's own models here.
 *
 * Endpoints (see packages/spicytool/backend):
 *   GET /api/v1/airports?q=&limit=              ranked typeahead
 *   GET /api/v1/calendar?origin&destination…    cheapest award per day
 *   GET /api/v2/search?origin&destination&date… aggregated award results
 */

export interface SpicyToolAirport {
	code: string;
	name: string;
	city: string;
	country: string;
	region: string;
}

export interface SpicyToolCalendarDay {
	date: string;
	available: boolean;
	points?: number;
	cash_fees?: number;
	program?: string;
	program_code?: string;
	airline?: string;
	cabin?: string;
}

export interface SpicyToolCalendarResponse {
	origin: string[];
	destination: string[];
	start_date: string;
	days: number;
	cabin: string;
	calendar: SpicyToolCalendarDay[];
}

export interface CabinOption {
	value: string;
	label: string;
}

/** Cabins SpicyTool understands, mapped to the widget's passenger-class labels. */
export const SPICYTOOL_CABINS: CabinOption[] = [
	{ value: 'economy', label: 'Economy' },
	{ value: 'premium', label: 'Premium' },
	{ value: 'business', label: 'Business' },
	{ value: 'first', label: 'First' }
];

/** The widget's `Economy`/`Business` service class → SpicyTool cabin string. */
export const toSpicyToolCabin = (serviceClass?: string): string =>
	serviceClass === 'Business' ? 'business' : 'economy';

export const airportsURL = (apiBase: string, query: string, limit: number = 8): string =>
	URL(`${apiBase}/api/v1/airports`, { q: query, limit });

export const calendarURL = (
	apiBase: string,
	params: { origin: string; destination: string; startDate: string; days?: number; cabin?: string }
): string =>
	URL(`${apiBase}/api/v1/calendar`, {
		origin: params.origin,
		destination: params.destination,
		start_date: params.startDate,
		days: params.days || 30,
		cabin: params.cabin || 'economy'
	});

export const searchURL = (
	apiBase: string,
	params: {
		origin: string;
		destination: string;
		date: string;
		cabin?: string;
		passengers?: number;
		maxStops?: number;
		returnDate?: string;
		returnFlex?: number;
	}
): string =>
	URL(`${apiBase}/api/v2/search`, {
		origin: params.origin,
		destination: params.destination,
		date: params.date,
		cabin: params.cabin || 'economy',
		passengers: params.passengers || 1,
		// `0` means non-stop. Sent as a string because the URL helper drops
		// falsy values and `0` is a meaningful choice here, not an omission.
		max_stops: params.maxStops === 0 ? '0' : params.maxStops,
		return_date: params.returnDate,
		return_flex: params.returnDate ? params.returnFlex || 0 : undefined
	});

export const providersURL = (apiBase: string): string => `${apiBase}/api/v2/providers`;
export const healthURL = (apiBase: string): string => `${apiBase}/api/v1/health`;

/**
 * Map a SpicyTool airport onto the widget's `Airport` model.
 *
 * The city is the headline name (that is what people search for); the airport's
 * own name stays on `properName` for the secondary line.
 */
export const parseSpicyToolAirport = (
	item: SpicyToolAirport,
	customNames?: { [locale: string]: string },
	locale?: Language
): Airport => {
	const cityName = item.city || item.name;
	const airportName = item.name || cityName;
	let name = cityName;
	let nameEn = cityName;

	if (customNames) {
		if (customNames.hasOwnProperty(locale)) {
			name = customNames[locale];
		}

		if (customNames.hasOwnProperty('en')) {
			nameEn = customNames['en'];
		}
	}

	return {
		IATA: item.code,
		airportRating: null,
		isAggregation: false,
		isCity: false,
		name,
		nameEn,
		properName: airportName,
		properNameEn: airportName,
		city: {
			IATA: item.code,
			airports: [{ IATA: item.code }],
			countryCode: item.country,
			id: null,
			name: cityName,
			nameEn: cityName
		},
		country: {
			code: item.country,
			name: item.country,
			nameEn: item.country
		}
	} as Airport;
};

/** Map a `/api/v1/airports` response onto the widget's suggestion list. */
export const parseSpicyToolAirports = (
	response: SpicyToolAirport[],
	params: {
		customAirportNames?: AirportNamesPool;
		locale?: Language;
		airportsBlackList?: Set<string>;
	}
): AutocompleteSuggestion[] => {
	const { customAirportNames = {}, locale, airportsBlackList } = params;
	const items = Array.isArray(response) ? response : [];

	return items
		.filter(item => item && item.code)
		.filter(item => !(airportsBlackList && airportsBlackList.has(item.code)))
		.map(item => ({
			airport: parseSpicyToolAirport(item, customAirportNames[item.code], locale)
		}));
};

/**
 * Map a `/api/v1/calendar` response onto the widget's available-dates list.
 *
 * SpicyTool reports the cheapest award **in points** per day, which is real
 * pricing data — so it is carried through instead of a bare availability flag.
 */
export const parseSpicyToolCalendar = (response: SpicyToolCalendarResponse): AvailableDateResponse[] => {
	const calendar = response && Array.isArray(response.calendar) ? response.calendar : [];

	return calendar
		.filter(day => day && day.date && day.available)
		.map(day => ({
			date: day.date,
			points: day.points,
			cashFees: day.cash_fees,
			program: day.program
		} as AvailableDateResponse));
};

/**
 * Turn a priced calendar into heat levels.
 *
 * The baseline is the **median** of the month, not the worst day: a fare 20%
 * below the median is genuinely a good day to fly, and one fare spike should
 * not make the whole month look cheap. No prices (or a single day) means no
 * invented heat — every day comes back `mild`.
 */
export const calendarHeat = (
	dates: AvailableDateResponse[]
): { [date: string]: { heat: string; baseline: number } } => {
	const priced = dates.filter(day => day && day.date && typeof day.points === 'number' && day.points > 0);

	if (priced.length < 2) {
		return {};
	}

	const sorted = priced.map(day => day.points).sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	const baseline = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;

	const result: { [date: string]: { heat: string; baseline: number } } = {};

	priced.forEach(day => {
		const discount = (1 - day.points / baseline) * 100;

		result[day.date] = {
			heat: discount >= 50 ? HEAT_LEVELS[3] : discount >= 35 ? HEAT_LEVELS[2] : discount >= 20 ? HEAT_LEVELS[1] : HEAT_LEVELS[0],
			baseline
		};
	});

	return result;
};

/** Build a `HotDeal` from a priced calendar day, so the spice rack can show it. */
export const dealFromCalendarDay = (
	origin: string,
	destination: string,
	day: AvailableDateResponse,
	baseline?: number
): HotDeal => ({
	departure: origin,
	arrival: destination,
	price: day.points,
	baselinePrice: baseline,
	departDate: day.date
});
