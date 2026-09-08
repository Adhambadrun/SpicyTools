import { AirportNamesPool, Language } from '../../state';
import { parseAutocompleteOptions } from '../parsers/autocomplete';
import { AutocompleteSuggestion } from '../models/AutocompleteSuggestion';
import { fetchWithFallback } from '../../utils';

interface Params {
	citiesOnly: boolean;
	customAirportNames: AirportNamesPool;
	locale: Language;
	airportsBlackList: Set<string>
}

export default async (requestURL: string, params: Params, fallbackURL?: string): Promise<AutocompleteSuggestion[]> => {
	const response = await fetchWithFallback({ url: requestURL, fallbackURL });
	const { citiesOnly, customAirportNames, locale, airportsBlackList } = params;

	return parseAutocompleteOptions(await response.json(), citiesOnly, customAirportNames, locale, airportsBlackList);
};
