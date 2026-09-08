import {
	AUTOCOMPLETE_LOADING_STARTED,
	AUTOCOMPLETE_LOADING_FINISHED,
	AUTOCOMPLETE_SUGGESTIONS_CHANGED,
	AIRPORT_SELECTED,
	AUTOCOMPLETE_PUSH_TO_PREVIOUS, RUN_AUTOCOMPLETE, SET_NEAR_SUGGESTED_AIRPORT
} from '../../../actions';
import { parseNearestAirport } from '../../../../services/parsers';
import { parseDatesAvailability } from '../../../../services/parsers/datesAvailability';
import { URL, clearURL, fetchWithFallback } from '../../../../utils';
import {
	ApplicationMode, ApplicationState, AutocompleteFieldType, CommonThunkAction,
	DatepickerFieldType, GetStateFunction
} from '../../../../state';
import { setAvailableDates } from '../dates/actions';
import { AnyAction, Dispatch } from 'redux';
import { AutocompleteSuggestion } from '../../../../services/models/AutocompleteSuggestion';
import { Airport } from '../../../../services/models/Airport';
import { ResponseWithGuide } from '../../../../services/responses/Guide';
import { getLocaleForApi, isCR, isRT } from '../../selectors';
import { parseAirport } from '../../../../services/parsers/airport';
import { airportsURL, calendarURL, parseSpicyToolCalendar, toSpicyToolCabin } from '../../../../services/spicytool';
import { AvailableDateResponse } from '../../../../services/responses/AvailableDates';
import * as moment from 'moment';
import spicyToolAirports from '../../../../services/requests/airports';

export interface AutocompleteAction {
	type: string;
	autocompleteType: AutocompleteFieldType;
	payload?: any;
	segmentId?: number;
}

export interface PreviousSearchAction {
	type: string;
	payload: any;
	isPreviousSearchAction: boolean;
}

export interface NearSuggestedAirportAction {
	type: string;
	route: string;
	airport: any;
	distance: number;
}

export type RunAutocompleteAction = ReturnType<typeof runAutocompleteRequest>;

/**
 * Show autocomplete field loading spinner.
 *
 * @param {AutocompleteFieldType} autocompleteType
 * @param {number} segmentId
 * @returns {AutocompleteAction}
 */
export const startAutocompleteLoading = (autocompleteType: AutocompleteFieldType, segmentId: number): AutocompleteAction => {
	return {
		type: AUTOCOMPLETE_LOADING_STARTED,
		autocompleteType,
		segmentId
	};
};

/**
 * Hide autocomplete field loading spinner.
 *
 * @param {AutocompleteFieldType} autocompleteType
 * @param {number} segmentId
 * @returns {AutocompleteAction}
 */
export const finishAutocompleteLoading = (autocompleteType: AutocompleteFieldType, segmentId: number): AutocompleteAction => {
	return {
		type: AUTOCOMPLETE_LOADING_FINISHED,
		autocompleteType,
		segmentId
	};
};

/**
 * Store an array of autocomplete options.
 *
 * @param {Array} suggestions
 * @param {AutocompleteFieldType} autocompleteType
 * @param {number} segmentId
 * @returns {AutocompleteAction}
 */
export const changeAutocompleteSuggestions = (suggestions: AutocompleteSuggestion[], autocompleteType: AutocompleteFieldType, segmentId: number = 0): AutocompleteAction => {
	return {
		type: AUTOCOMPLETE_SUGGESTIONS_CHANGED,
		autocompleteType,
		segmentId,
		payload: {
			suggestions
		}
	};
};

/**
 * Running request for getting list of dates with available flights.
 *
 * @param {Dispatch} dispatch
 * @param {ApplicationState} state
 * @param {number} segmentId
 * @param {DatepickerFieldType} dateType
 */
const runDatesAvailability = (
	dispatch: Dispatch<AnyAction, any>,
	state: ApplicationState, segmentId: number,
	dateType: DatepickerFieldType = DatepickerFieldType.Departure,
	departureIATA: string = '',
	arrivalIATA: string = ''
): void => {
	let depIATA, arrIATA;

	depIATA = state.form.segments[segmentId].autocomplete.departure.airport ? state.form.segments[segmentId].autocomplete.departure.airport.IATA : departureIATA;
	arrIATA = state.form.segments[segmentId].autocomplete.arrival.airport ? state.form.segments[segmentId].autocomplete.arrival.airport.IATA : arrivalIATA;

	if (dateType === DatepickerFieldType.Return) {
		const tmp = depIATA;

		depIATA = arrIATA;
		arrIATA = tmp;
	}

	let urlBase = '/api/';

	if (state.system.mode === ApplicationMode.WEBSKY) {
		urlBase += `proxy/websky/availability/dep/${depIATA}/arr/${arrIATA}`;
	}

	const requestParams = state.system.mode === ApplicationMode.WEBSKY ? {
		webskyURL: encodeURIComponent(state.system.webskyURL)
	} : {};

	const runRequest = (base: string, parser: (response: any) => AvailableDateResponse[]) => {
		return fetchWithFallback({ url: base })
			.then(response => response.json())
			.then(response => {
				const dates = parser(response);

				if (dates) {
					dispatch(setAvailableDates(dates, segmentId, dateType));
				} else {
					dispatch(setAvailableDates([], segmentId, dateType));
				}
			})
			.catch(() => {
				dispatch(setAvailableDates([], segmentId, dateType));
			});
	};

	if (state.system.mode === ApplicationMode.WEBSKY) {
		// Websky keeps its own availability endpoint and response envelope.
		runRequest(URL(`${clearURL(state.system.spicyURL)}${urlBase}`, requestParams), parseDatesAvailability);
	} else if (depIATA && arrIATA) {
		// SpicyTool: cheapest award per day, priced in points.
		const calendarParams = {
			origin: depIATA,
			destination: arrIATA,
			startDate: moment().format('YYYY-MM-DD'),
			days: 30,
			cabin: toSpicyToolCabin(state.form.additional.classType)
		};

		runRequest(calendarURL(clearURL(state.system.spicyURL), calendarParams), parseSpicyToolCalendar);
	}
};

/**
 * Running two request for getting dates with available flights:
 * - one for the forward direction
 * - one for the return flight
 *
 * (currently available for the WEBSKY mode only)
 *
 * @param {Dispatch} dispatch
 * @param {ApplicationState} getState
 * @param {number} segmentId
 */
export const getDatesAvailability = (dispatch: Dispatch<AnyAction, any>, getState: GetStateFunction, segmentId: number = 0, depIATA: string = '', arrIATA: string = ''): void => {
	const state = getState();

	if (
		state.system.highlightAvailableDates &&
		(state.form.segments[segmentId].autocomplete.departure.airport || depIATA) &&
		(state.form.segments[segmentId].autocomplete.arrival.airport || arrIATA)
	) {
		// Searching available dates for the flight forward.
		runDatesAvailability(dispatch, state, segmentId, DatepickerFieldType.Departure, depIATA, arrIATA);

		// Searching available dates for the flight return.
		if (segmentId === 0) {
			runDatesAvailability(dispatch, state, segmentId, DatepickerFieldType.Return);
		}
	}
};

/**
 * Store airport selected by user.
 *
 * @param {Object} airport
 * @param {number} segmentId
 * @param {AutocompleteFieldType} autocompleteType
 * @returns {AutocompleteAction}
 */
export const setSelectedAirport = (airport: Airport, autocompleteType: AutocompleteFieldType, segmentId: number = 0): AutocompleteAction => {
	return {
		type: AIRPORT_SELECTED,
		autocompleteType,
		segmentId,
		payload: {
			airport
		}
	};
};

/**
 * FIXME
 *
 * @param pool
 * @returns {AutocompleteAction}
 */
export const setAirportInPreviousSearchGroup = (pool: any): PreviousSearchAction => {
	return {
		type: AUTOCOMPLETE_PUSH_TO_PREVIOUS,
		isPreviousSearchAction: true,
		payload: {
			pool
		}
	};
};

export const setNearSuggetedAirport = (route: string, airport: any, distance: number): NearSuggestedAirportAction => {
	return {
		type: SET_NEAR_SUGGESTED_AIRPORT,
		route,
		airport,
		distance
	};
};

/**
 * @param {Dispatch} dispatch
 * @param {Function} getState
 * @param airport
 */
export const pushAiprortInCache = (dispatch: Dispatch<PreviousSearchAction, ApplicationState>, getState: GetStateFunction, airport: Airport): void => {
	const MAX_NUM_OF_AIRPORTS = 9;
	const appState = getState();
	const state = appState.form.segments[0].autocomplete.defaultGroups.previousSearches.options;
	const newPool: any = {};
	let counter = 0;

	newPool[airport.IATA] = airport;

	for (const airport in state) {
		if (state.hasOwnProperty(airport)) {
			if (!newPool[state[airport].IATA]) {
				counter++;
			}

			newPool[state[airport].IATA] = state[airport];
		}

		if (counter >= MAX_NUM_OF_AIRPORTS) {
			break;
		}
	}

	dispatch(setAirportInPreviousSearchGroup(newPool));
};

export const getArrivalSuggestAirport = (dispath: Dispatch<AnyAction, any>, getState: GetStateFunction) => {
	const state = getState();

	if (
		!isCR(state) &&
		state.form.segments[0].autocomplete.arrival.airport &&
		state.form.segments[0].autocomplete.departure.airport &&
		state.system.arrivalSuggestions.hasOwnProperty(`${state.form.segments[0].autocomplete.departure.airport.IATA}-${state.form.segments[0].autocomplete.arrival.airport.IATA}`)
	) {
		const route = `${state.form.segments[0].autocomplete.departure.airport.IATA}-${state.form.segments[0].autocomplete.arrival.airport.IATA}`,
			suggestedAirport = state.system.arrivalSuggestions[`${state.form.segments[0].autocomplete.departure.airport.IATA}-${state.form.segments[0].autocomplete.arrival.airport.IATA}`];

		const urlBase = `/api/guide/airports/${suggestedAirport.suggestion}?apilang=${getLocaleForApi(state)}`,
			{ spicyURL,  fallbackSpicyURL } = state.system;

		fetchWithFallback({
			url: `${spicyURL}${urlBase}`,
			fallbackURL: fallbackSpicyURL ? `${fallbackSpicyURL}${urlBase}` : undefined
		}).then(response => response.json())
			.then(response => dispath(setNearSuggetedAirport(route, parseAirport({ IATA: suggestedAirport.suggestion }, response.guide), suggestedAirport.distance)));
	}
};

/**
 * Store airport selected by user and run request for getting dates with available flight.
 *
 * @param {Object} airport
 * @param {number} segmentId
 * @param {AutocompleteFieldType} autocompleteType
 * @returns {Function}
 */
export const selectAirport = (airport: any, autocompleteType: AutocompleteFieldType, segmentId: number = 0): CommonThunkAction => {
	return (dispatch, getState): void => {
		dispatch(setSelectedAirport(airport, autocompleteType, segmentId));

		if (isRT(getState())) {
			if (autocompleteType === AutocompleteFieldType.Departure) {
				dispatch(setSelectedAirport(airport, AutocompleteFieldType.Arrival, 1));
			} else {
				dispatch(setSelectedAirport(airport, AutocompleteFieldType.Departure, 1));
			}
		}

		getArrivalSuggestAirport(dispatch, getState);
		getDatesAvailability(dispatch, getState, segmentId);
		pushAiprortInCache(dispatch, getState, airport);
	};
};

/**
 * Send request for getting autocomplete options.
 *
 * @param {String} searchText
 * @param {AutocompleteFieldType} autocompleteType
 * @param {number} segmentId
 */
export const runAutocompleteRequest = (searchText: string, autocompleteType: AutocompleteFieldType, segmentId: number = 0) => {
	return {
		type: RUN_AUTOCOMPLETE,
		payload: {
			searchText,
			autocompleteType,
			segmentId
		}
	};
};

/**
 * Load airport by IATA code and set it as the default airport for departure or arrival.
 *
 * @param {String} IATA
 * @param {AutocompleteFieldType} autocompleteType
 * @returns {Function}
 */
export const loadAirportForAutocomplete = (IATA: string, autocompleteType: AutocompleteFieldType): CommonThunkAction => {
	return (dispatch, getState): void => {
		const state = getState();
		const { spicyURL, fallbackSpicyURL, customAirportNames } = state.system;
		const locale = getLocaleForApi(state);
		spicyToolAirports(
			airportsURL(spicyURL, IATA, 1),
			{ customAirportNames, locale },
			fallbackSpicyURL ? airportsURL(fallbackSpicyURL, IATA, 1) : undefined
		)
			.then(suggestions => {
				if (suggestions.length) {
					dispatch(setSelectedAirport(suggestions[0].airport, autocompleteType));
				}
			});
	};
};

/**
 * Load nearest airport and set it as the default airport for departure or arrival.
 *
 * @param {AutocompleteFieldType} autocompleteType
 * @returns {Function}
 */
export const loadNearestAirportForAutocomplete = (autocompleteType: AutocompleteFieldType): CommonThunkAction => {
	return (dispatch, getState): void => {
		const state = getState();
		const { spicyURL, fallbackSpicyURL, customAirportNames } = state.system;
		const locale = getLocaleForApi(state);
		// SpicyTool exposes no IP-geolocation endpoint, and guessing an airport
		// from an IP would put the wrong city in the form — so this is a no-op
		// rather than a fabricated suggestion. Use `defaultDepartureAirport`.
		console.warn('[SpicyQuote] `useNearestAirport` needs an IP-geolocation endpoint, which SpicyTool does not provide. Set `defaultDepartureAirport` instead.');
	};
};

/**
 * Change the departure and the arrival airports.
 */
export const swapAirports = (segmentId: number): CommonThunkAction => {
	return (dispatch, getState): void => {
		const
			state = getState(),
			departureAirport = state.form.segments[segmentId].autocomplete.departure.airport,
			arrivalAirport = state.form.segments[segmentId].autocomplete.arrival.airport;

		if (departureAirport || arrivalAirport) {
			dispatch(setSelectedAirport(departureAirport, AutocompleteFieldType.Arrival, segmentId));
			dispatch(setSelectedAirport(arrivalAirport, AutocompleteFieldType.Departure, segmentId));

			if (segmentId === 0 && isRT(getState())) {
				dispatch(setSelectedAirport(departureAirport, AutocompleteFieldType.Departure, 1));
				dispatch(setSelectedAirport(arrivalAirport, AutocompleteFieldType.Arrival, 1));
			}
			getDatesAvailability(dispatch, getState, segmentId);
		}
	};
};
