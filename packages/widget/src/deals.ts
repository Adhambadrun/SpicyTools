import { Airport } from './services/models/Airport';

/**
 * A fare worth shouting about.
 *
 * SpicyTools never invents prices: a deal is only as hot as the numbers the site
 * owner feeds in. Give us `price` and `baselinePrice` (the fare this route usually
 * sells at) and the widget works out the heat; give us only `price` and we call it
 * `mild` rather than pretending it is a steal.
 */
export interface HotDeal {
	/** IATA code of the departure airport or city. */
	departure: string;
	/** IATA code of the arrival airport or city. */
	arrival: string;
	/** Current fare. */
	price: number;
	/** Typical fare for this route — the reference point for the heat rating. */
	baselinePrice?: number;
	/** ISO-4217 code, e.g. `USD`. Purely cosmetic. */
	currency?: string;
	/** `YYYY-MM-DD`. */
	departDate?: string;
	/** `YYYY-MM-DD`. Presence turns the deal into a round trip. */
	returnDate?: string;
	airline?: string;
	directFlight?: boolean;
	/** Short hook for the deal, e.g. "Long weekend in Lisbon". */
	label?: string;
	/** Display names; fall back to the bare IATA code when omitted. */
	departureName?: string;
	arrivalName?: string;
}

export type HeatLevel = 'mild' | 'medium' | 'hot' | 'inferno';

/** Ordered coolest → hottest. */
export const HEAT_LEVELS: HeatLevel[] = ['mild', 'medium', 'hot', 'inferno'];

/** How many chillies a heat level is worth, for the badge UI. */
export const PEPPERS_PER_LEVEL: { [level: string]: number } = {
	mild: 1,
	medium: 2,
	hot: 3,
	inferno: 4
};

/** Discount (0–100) of the fare against its baseline. `0` when unknown. */
export const getDiscount = (deal: HotDeal): number => {
	if (!deal || !deal.baselinePrice || deal.baselinePrice <= 0 || !deal.price) {
		return 0;
	}

	const discount = (1 - deal.price / deal.baselinePrice) * 100;

	return discount > 0 ? Math.round(discount) : 0;
};

/**
 * Turn a deal into a heat level.
 *
 * < 20% off → mild · 20–34% → medium · 35–49% → hot · 50%+ → inferno.
 */
export const getHeatLevel = (deal: HotDeal): HeatLevel => {
	const discount = getDiscount(deal);

	if (discount >= 50) {
		return 'inferno';
	}

	if (discount >= 35) {
		return 'hot';
	}

	if (discount >= 20) {
		return 'medium';
	}

	return 'mild';
};

export const getPeppers = (deal: HotDeal): number => PEPPERS_PER_LEVEL[getHeatLevel(deal)];

/** Hottest first, then cheapest. */
export const sortByHeat = (deals: HotDeal[]): HotDeal[] => {
	return (deals || []).slice().sort((a, b) => {
		const heatDiff = HEAT_LEVELS.indexOf(getHeatLevel(b)) - HEAT_LEVELS.indexOf(getHeatLevel(a));

		if (heatDiff !== 0) {
			return heatDiff;
		}

		return (a.price || Number.MAX_VALUE) - (b.price || Number.MAX_VALUE);
	});
};

/** Build a minimal `Airport` good enough to fill the form from an IATA code. */
export const airportFromIATA = (IATA: string, name?: string): Airport => {
	const airportName = name || IATA;

	return {
		IATA,
		name: airportName,
		nameEn: airportName,
		properName: airportName,
		properNameEn: airportName,
		airportRating: null,
		isAggregation: false,
		isCity: true,
		city: null,
		country: null
	} as Airport;
};
