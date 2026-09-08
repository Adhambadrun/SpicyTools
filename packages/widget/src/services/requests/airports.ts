import { AirportNamesPool, Language } from '../../state';
import { AutocompleteSuggestion } from '../models/AutocompleteSuggestion';
import { parseSpicyToolAirports, SpicyToolAirport } from '../spicytool';
import { fetchWithFallback } from '../../utils';

interface Params {
	customAirportNames?: AirportNamesPool;
	locale?: Language;
	airportsBlackList?: Set<string>;
}

/**
 * Airport typeahead against the SpicyTool API.
 *
 * The response is the flat `[{ code, name, city, country, region }]` list from
 * `GET /api/v1/airports` — no `guide` envelope, no city/aggregation expansion.
 */
export default async (requestURL: string, params: Params = {}, fallbackURL?: string): Promise<AutocompleteSuggestion[]> => {
	const response = await fetchWithFallback({ url: requestURL, fallbackURL });

	return parseSpicyToolAirports(await response.json() as SpicyToolAirport[], params);
};
