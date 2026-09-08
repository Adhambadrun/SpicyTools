import { ResponseWithGuide } from './responses/Guide';
import { Airport } from './models/Airport';
import { AirportNamesPool, Language } from '../state';
import { parseAirport } from './parsers/airport';

export const parseNearestAirport = (response: ResponseWithGuide, customAirportNames: AirportNamesPool, locale: Language): Airport => {
	let airport: Airport = null;

	if (response && response.guide && response.guide.nearestAirport) {
		airport = parseAirport({ IATA: response.guide.nearestAirport }, response.guide, customAirportNames[response.guide.nearestAirport], locale);
	}

	return airport;
};
