import { call, put, select, takeEvery } from 'redux-saga/effects';

import { RUN_AUTOCOMPLETE } from '../../../actions';
import { ApplicationMode, AutocompleteFieldType, Language, SegmentState, SystemState } from '../../../../state';
import {
	changeAutocompleteSuggestions,
	finishAutocompleteLoading,
	RunAutocompleteAction,
	startAutocompleteLoading
} from './actions';
import autocomplete from '../../../../services/requests/autocomplete';
import { setAutocompleteSuggestionsForGrid } from '../../gridAutocomplete/actions';
import { clearURL, URL } from '../../../../utils';
import { getConfig, getLocaleForApi, getSegments } from '../../selectors';
import { AutocompleteSuggestion } from '../../../../services/models/AutocompleteSuggestion';

interface AutocompleteRequestParams {
	apilang: Language;
	webskyURL?: string;
	airlineIATA?: string;
}

function* runAutocomplete(requestURL: string, autocompleteType: AutocompleteFieldType, segmentId = 0, departureIATA = '', fallbackURL?: string) {
	const {
		citiesOnly,
		customAirportNames,
		locale,
		airportsBlackList,
		routingGrid,
		mode
	}: SystemState = yield select(getConfig);

	yield put(startAutocompleteLoading(autocompleteType, segmentId));

	try {
		const options: AutocompleteSuggestion[] = yield call(autocomplete, requestURL, {
			citiesOnly, customAirportNames, locale, airportsBlackList: airportsBlackList as Set<string>
		}, fallbackURL);

		if (options) {
			if (!!routingGrid || mode === ApplicationMode.WEBSKY) {
				yield put(setAutocompleteSuggestionsForGrid(departureIATA, options));
			} else {
				yield put(changeAutocompleteSuggestions(options, autocompleteType, segmentId));
			}
		}

		yield put(finishAutocompleteLoading(autocompleteType, segmentId));
	} catch (error) {
		yield put(changeAutocompleteSuggestions([], autocompleteType, segmentId));
		yield put(finishAutocompleteLoading(autocompleteType, segmentId));
	}
}

function* worker({ payload }: RunAutocompleteAction) {
	let urlBase = '', departureIATA = '';
	const { searchText, autocompleteType, segmentId } = payload;

	const config: SystemState = yield select(getConfig);
	const segments: SegmentState[] = yield select(getSegments);
	const locale: Language = yield select(getLocaleForApi);

	const spicyURL = clearURL(config.spicyURL);
	const fallbackURL = config.fallbackSpicyURL ? clearURL(config.fallbackSpicyURL) : undefined;
	const requestParams: AutocompleteRequestParams = {
		apilang: locale
	};

	// Prepare request info.
	if (config.mode === ApplicationMode.WEBSKY) {
		const searchType = autocompleteType === 'arrival' ? 'arr' : 'dep';

		if (autocompleteType === AutocompleteFieldType.Arrival && segments[0].autocomplete.departure.airport) {
			departureIATA = segments[0].autocomplete.departure.airport.IATA;
		}

		urlBase = `/api/proxy/websky/cities/${departureIATA}/${searchType}`;
		requestParams.webskyURL = encodeURIComponent(config.webskyURL);
	} else {
		urlBase = `/api/guide/autocomplete/iata/${searchText}`;

		if (autocompleteType === AutocompleteFieldType.Arrival && segments[segmentId].autocomplete.departure.airport) {
			departureIATA = segments[segmentId].autocomplete.departure.airport.IATA;
			urlBase += `/dep/${departureIATA}`;
		}

		if (config.routingGrid) {
			requestParams.airlineIATA = config.routingGrid;
		}
	}

	// Run autocomplete request.
	yield call(
		runAutocomplete,
		URL(`${spicyURL}${urlBase}`, requestParams),
		autocompleteType,
		segmentId,
		departureIATA,
		fallbackURL ? URL(`${fallbackURL}${urlBase}`, requestParams) : undefined
	);
}

export default function* runAutocompleteSaga() {
	yield takeEvery(RUN_AUTOCOMPLETE, worker);
}
