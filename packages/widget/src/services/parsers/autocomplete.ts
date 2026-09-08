import { AutocompleteAirportItem, GuideResponse, ResponseWithGuide } from '../responses/Guide';
import { AirportNamesPool, Language } from '../../state';
import { AutocompleteSuggestion } from '../models/AutocompleteSuggestion';
import { CityResponseAirportItem } from '../responses/City';
import { parseAirport } from './airport';

/**
 * Get list of airports that are assigned to a city.
 *
 * @param responseObject
 * @param guide
 */
const getInnerAirports = (responseObject: AutocompleteAirportItem, guide: GuideResponse): CityResponseAirportItem[] => {
	if (
		responseObject.isCity &&
		guide.cities.hasOwnProperty(responseObject.cityId) &&
		guide.cities[responseObject.cityId].airports
	) {
		return guide.cities[responseObject.cityId].airports;
	}

	return [];
};

export const parseAutocompleteOptions = (
	response: ResponseWithGuide,
	citiesOnly: boolean,
	customAirportNames: AirportNamesPool,
	locale: Language,
	airportsBlackList: Set<string>
) => {
	const options: AutocompleteSuggestion[] = [];

	if (response && response.guide.autocomplete.iata) {
		const { airports } = response.guide;

		response.guide.autocomplete.iata.forEach(responseAirport => {
			const IATA = responseAirport.IATA;

			// Do not parse banned airports or airports without a name.
			if (!airportsBlackList.has(IATA) && airports.hasOwnProperty(IATA) && !!airports[IATA].name) {
				const parsedAirport = parseAirport(responseAirport, response.guide, customAirportNames[responseAirport.IATA], locale);

				if (parsedAirport) {
					const option: AutocompleteSuggestion = {
						airport: parsedAirport,
						isDirect: responseAirport.directFlight
					};

					// If it's not a `citiesOnly` mode - load airports assigned to a city.
					let innerAirports = !citiesOnly ? getInnerAirports(responseAirport, response.guide) : [];

					// If city has only one airport inside - ignore it.
					if (innerAirports.length === 1) {
						innerAirports = [];
					}
					// Mark option as a aggregation root (for applying styles only).
					else if (innerAirports.length) {
						option.isAggregationRoot = true;
					}

					options.push(option);

					// Process airports assigned to a city.
					innerAirports.forEach(responseAirport => {
						const IATA = responseAirport.IATA;

						if (!airportsBlackList.has(IATA) && airports.hasOwnProperty(IATA) && !!airports[IATA].name) {
							const parsedAirport = parseAirport(responseAirport, response.guide, customAirportNames[responseAirport.IATA], locale);

							if (parsedAirport) {
								const option: AutocompleteSuggestion = {
									airport: parsedAirport,
									isInsideAggregation: true
								};

								options.push(option);
							}
						}
					});
				}
			}
		});
	}

	return options;
};
