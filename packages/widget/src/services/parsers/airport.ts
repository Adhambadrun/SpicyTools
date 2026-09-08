import { AutocompleteAirportItem, GuideResponse } from '../responses/Guide';
import { Airport } from '../models/Airport';
import { AirportNamesByLocale, Language } from '../../state';
import { City } from '../models/City';
import { Country } from '../models/Country';

interface GuideCache {
	airports: { [IATA: string]: Airport };
	cities: { [IATA: string]: City };
	countries: { [IATA: string]: Country };
}

const cache: GuideCache = {
	airports: {},
	cities: {},
	countries: {}
};

export const parseAirport = (responseObject: AutocompleteAirportItem, guide: GuideResponse, customNames?: AirportNamesByLocale, locale?: Language): Airport => {
	if (cache.airports.hasOwnProperty(responseObject.IATA)) {
		return cache.airports[responseObject.IATA];
	}

	let airport: Airport = null;

	if (guide && guide.airports.hasOwnProperty(responseObject.IATA)) {
		const airportData = guide.airports[responseObject.IATA];

		airport = {
			IATA: airportData.IATA,
			airportRating: airportData.airportRating,
			isAggregation: airportData.isAggregation,
			isCity: responseObject.isCity,
			name: airportData.name,
			nameEn: airportData.nameEn,
			properName: airportData.properName,
			properNameEn: airportData.properNameEn,
			city: guide.cities[airportData.cityId],
			country: guide.countries[airportData.countryCode]
		};

		// Use custom airport names if specified.
		if (customNames) {
			if (customNames.hasOwnProperty(locale)) {
				airport.name = customNames[locale];
			}

			if (customNames.hasOwnProperty('en')) {
				airport.nameEn = customNames['en'];
			}
		}
		// If an airport is a metropolitan area, then use city name as the default airport name.
		else if (responseObject.isCity && airport.city) {
			airport.name = airport.city.name;
			airport.nameEn = airport.city.nameEn;
			airport.properName = airport.city.name;
			airport.properNameEn = airport.city.nameEn;
		}
	}

	return airport;
};
