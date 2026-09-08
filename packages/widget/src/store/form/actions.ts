import { AnyAction } from 'redux';
import { SHOW_ERRORS } from '../actions';
import { formIsValid, getSearchInfo, getLocaleForApi } from './selectors';
import {
	ApplicationMode,
	ApplicationState,
	CommonThunkAction,
	PassengerState,
	SegmentState,
	SearchInfo,
	OnSearchFunction,
	SearchInfoSegment,
	RouteType,
	SEGMENTS_COUNT_RT,
	segmentState, PassengersState
} from '../../state';
import { URL, clearURL } from '../../utils';
import { searchURL, toSpicyToolCabin } from '../../services/spicytool';
import { setSegments } from './segments/actions';
import { setClassType } from './additional/actions';
import { setRouteTypeAction } from './route/actions';
import { setCounter } from './passengers/actions';
import { batchActions } from '../batching/actions';
import { eventTap, SearchFormEvent } from '../../services/eventLogger';

export interface ShowErrorsAction {
	type: string;
	payload: boolean;
}

export const showErrors = (shouldShowErrors: boolean): ShowErrorsAction => {
	return {
		type: SHOW_ERRORS,
		payload: shouldShowErrors
	};
};

/**
 * Complex route may be as round-trip. Checking it
 *
 * @param {ApplicationState} state
 * @return {boolean}
 */
const isSearchRT = (state: ApplicationState): boolean => {
	const form = state.form;

	return form.routeType === RouteType.RT ||
		(
			form.routeType === RouteType.CR &&
			form.segments.length === SEGMENTS_COUNT_RT &&
			form.segments[0].autocomplete.arrival.airport.IATA === form.segments[1].autocomplete.departure.airport.IATA &&
			form.segments[0].autocomplete.departure.airport.IATA === form.segments[1].autocomplete.arrival.airport.IATA
		);
};

export const spicyFastSearchSegment = (segment: SegmentState, isAWP?: boolean): string => {
	let request = '';

	if (!isAWP) {
		request += segment.autocomplete.departure.airport.isCity ? 'c' : 'a';
	}

	request += segment.autocomplete.departure.airport.IATA;

	// Arrival airport info.
	if (!isAWP) {
		request += segment.autocomplete.arrival.airport.isCity ? 'c' : 'a';
	}

	request += segment.autocomplete.arrival.airport.IATA;

	// Departure date info.
	request += segment.departureDate.date.format('YYYYMMDD');

	return request;
};

export const spicyFastSearchPassengers = (passengers: PassengersState): string => {
	let passengersInfo = '';

	for (const passType in passengers) {
		if (passengers.hasOwnProperty(passType) && passengers[passType].count) {
			const passConfig: PassengerState = passengers[passType];

			passengersInfo += `${passConfig.code}${passConfig.count}`;
		}
	}

	return passengersInfo;
};

/**
 * Total number of seats the search should be run for.
 */
const totalPassengers = (passengers: PassengersState): number => {
	let total = 0;

	for (const passType in passengers) {
		if (passengers.hasOwnProperty(passType) && passengers[passType].count) {
			total += passengers[passType].count;
		}
	}

	return total || 1;
};

/**
 * Build the SpicyTool search request for the current form state.
 *
 * This is the interface to the search engine: `GET {apiBase}/api/v2/search`
 * with the query the visitor filled in. The host page normally intercepts this
 * through the `onSearch` callback and renders the results itself.
 */
export const spicyToolSearchURL = (state: ApplicationState): string => {
	const segments = state.form.segments;
	const firstSegment = segments[0];

	return searchURL(clearURL(state.system.spicyURL), {
		origin: firstSegment.autocomplete.departure.airport.IATA,
		destination: firstSegment.autocomplete.arrival.airport.IATA,
		date: firstSegment.departureDate.date.format('YYYY-MM-DD'),
		cabin: toSpicyToolCabin(state.form.additional.classType),
		passengers: totalPassengers(state.form.passengers),
		returnDate: isSearchRT(state) && segments[1].departureDate.date ? segments[1].departureDate.date.format('YYYY-MM-DD') : undefined,
		returnFlex: state.form.additional.vicinityDates ? state.system.vicinityDays : undefined,
		maxStops: state.form.additional.directFlight ? 0 : undefined
	});
};

export const spicyFastSearch = (state: ApplicationState, isAWP?: boolean): string => {
	// SpicyTool mode builds a real search request against the API. The legacy
	// fast-search string below is only used by the Websky integration.
	if (state.system.mode !== ApplicationMode.WEBSKY) {
		return spicyToolSearchURL(state);
	}

	let requestURL = clearURL(state.system.spicyURL) + (isAWP ? '/#/results/' : '/results/');
	const segments = state.form.segments;

	requestURL += spicyFastSearchSegment(segments[0], isAWP);

	if (segments.length >= SEGMENTS_COUNT_RT) {
		if (isSearchRT(state)) {
			// Return date info
			requestURL += segments[1].departureDate.date.format('YYYYMMDD');
		}
		else if (state.form.routeType === RouteType.CR) {
			segments.forEach((segment, index) => {
				requestURL += index > 0 ? spicyFastSearchSegment(segment, isAWP) : '';
			});
		}
	}

	// Passengers info.
	requestURL += spicyFastSearchPassengers(state.form.passengers);

	// Class info.
	requestURL += '-class=' + state.form.additional.classType;

	// VicinityDates
	if (state.form.additional.vicinityDates) {
		requestURL += `-vicinityDates=${state.system.vicinityDays}`;
	}

	// Direct flight
	if (state.form.additional.directFlight) {
		requestURL += '-direct';
	}

	return requestURL;
};

export const runSpicySearch = (state: ApplicationState, isAWP?: boolean): void => {
	const url = state.system.mode === ApplicationMode.WEBSKY
		? URL(spicyFastSearch(state, isAWP), {
			changelang: getLocaleForApi(state),
			...state.system.utm
		})
		: URL(spicyToolSearchURL(state), state.system.utm);

	if (state.system.openNewTab) {
		const link = document.createElement('a');

		link.setAttribute('target', '_blank');
		link.setAttribute('href', url);
		link.style.display = 'none';

		document.body.appendChild(link);

		link.addEventListener('click', () => {
			link.remove();
		});

		link.click();
	}
	else {
		document.location.href = url;
	}
};

const runWebskySearch = (state: ApplicationState): void => {
	const form = document.getElementById('webskyHiddenForm') as HTMLFormElement;

	if (state.system.openNewTab) {
		form.target = '_blank';
	}

	if (form) {
		form.submit();
	}
};

/**
 * Starting search:
 * - run validation
 * - do some optional checks
 * - run search itself
 *
 * @param onSearch
 */
export const startSearch = (onSearch?: OnSearchFunction): CommonThunkAction => {
	return (dispatch, getState): void => {
		const state = getState();

		if (formIsValid(state)) {
			eventTap(SearchFormEvent.StartSearch);

			if (typeof onSearch === 'function') {
				onSearch(getSearchInfo(state));
			}
			else if (state.system.mode === ApplicationMode.SPICY) {
				runSpicySearch(state, state.system.isAWP);
			}
			else if (state.system.mode === ApplicationMode.WEBSKY) {
				runWebskySearch(state);
			}
		}
		else {
			dispatch(showErrors(true));
		}
	};
};

const convertSegmentSearchInfoToSegmentState = (segment: SearchInfoSegment): SegmentState => {
	const convertedSegment: SegmentState = JSON.parse(JSON.stringify(segmentState));

	convertedSegment.autocomplete.arrival.airport = segment.arrival;
	convertedSegment.autocomplete.departure.airport = segment.departure;
	convertedSegment.departureDate.date = segment.departureDate;

	return convertedSegment;
};

export const setSearchInfoAction = (searchInfo: SearchInfo): CommonThunkAction => {
	return dispatch => {
		const actions: AnyAction[] = [];

		if (searchInfo.segments) {
			const segmentsArray: SegmentState[] = [];

			searchInfo.segments.map(segment => {
				segmentsArray.push(convertSegmentSearchInfoToSegmentState(segment));
			});

			actions.push(setSegments(segmentsArray));
		}

		if (searchInfo.routeType) {
			actions.push(setRouteTypeAction(searchInfo.routeType));
		}

		if (searchInfo.serviceClass) {
			actions.push(setClassType(searchInfo.serviceClass));
		}

		if (searchInfo.passengers) {
			searchInfo.passengers.map(passenger => {
				actions.push(setCounter(passenger.count, passenger.type));
			});
		}

		dispatch(batchActions(...actions));
	};
};
