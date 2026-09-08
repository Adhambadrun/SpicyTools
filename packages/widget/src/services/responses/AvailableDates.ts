import { SystemResponse } from './System';

export interface AvailableDateResponse {
	date: string;

	/**
	 * Cheapest award on this day, in points.
	 *
	 * SpicyTool prices its calendar, so availability comes with a real number
	 * attached — which is what lets SpicyTools rate days on the heat scale
	 * instead of only saying "there is a flight". Absent when the backend
	 * reports availability without pricing.
	 */
	points?: number;

	/** Taxes and carrier charges on top of the points, in `currency`. */
	cashFees?: number;

	/** Loyalty program holding the cheapest award, e.g. "Air Canada Aeroplan". */
	program?: string;
}

export interface ResponseWithAvailableDates extends SystemResponse {
	flights?: {
		availability?: {
			dates?: AvailableDateResponse[];
		};
	};
}
