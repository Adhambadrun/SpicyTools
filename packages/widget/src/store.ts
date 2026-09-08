import { AnyAction, applyMiddleware, createStore, Middleware, Store } from 'redux';
import thunk from 'redux-thunk';
import * as moment from 'moment';
import createSagaMiddleware from 'redux-saga';

import * as Cache from './cache';
import rootReducer from './store/reducer';
import { setCounter } from './store/form/passengers/actions';
import { configReducer } from './store/system/reducer';
import { getTotalPassengersCount } from './store/form/passengers/selectors';
import {
	ApplicationCachedState,
	ApplicationMode,
	ApplicationState,
	AutocompleteFieldType,
	fillStateFromCache,
	initialState,
	PassengerType,
	RouteType,
	SEGMENTS_COUNT_RT,
	systemState,
	SystemState
} from './state';
import { setClassType } from './store/form/additional/actions';
import {
	getDatesAvailability,
	loadAirportForAutocomplete,
	loadNearestAirportForAutocomplete,
	runAutocompleteRequest,
	setSelectedAirport
} from './store/form/segments/autocomplete/actions';
import { addSegment } from './store/form/segments/actions';
import { selectDate } from './store/form/segments/dates/actions';
import { setRouteType } from './store/form/route/actions';
import rootSaga from './store/sagas';

const middlewares: Middleware[] = [thunk];
const STORE_CACHE_KEY = 'cached_store';

const enableReduxLogger = (isEnabled: boolean = false): void => {
	if (isEnabled) {
		const logger = require('redux-logger').default;

		middlewares.push(logger);
	}
};

/* global process */
if (process.env.NODE_ENV !== 'production') {
	enableReduxLogger(false);
}

/**
 * Get cached state object.
 */
export const getCachedState = (): ApplicationCachedState => {
	const cachedState = Cache.get(`${STORE_CACHE_KEY}_${Cache.getLocale()}_${process.env.VERSION}`);

	return cachedState ? cachedState as ApplicationCachedState : null;
};

/**
 * Caching current state.
 *
 * @param state
 */
export const cacheState = (state: ApplicationState): void => {
	if (!state.system.disableCaching) {
		const newState: ApplicationState = { ...state, system: { ...state.system, rootElement: null } };

		Cache.set(`${STORE_CACHE_KEY}_${Cache.getLocale()}_${process.env.VERSION}`, newState);
	}
};

/**
 * Create Redux-store.
 *
 * @param {Object} config - system configuration object.
 *
 * @returns {Store}
 */
export const getStore = (config: SystemState): Store<ApplicationState> => {
	// `apiBase` is the documented way to point the widget at a SpicyTool API.
	// `spicyURL` is its deprecated alias — accept either, prefer `apiBase`.
	if (!config.spicyURL && config.apiBase) {
		config.spicyURL = config.apiBase;
	}

	// Convert airports black list from array to a set of unique values.
	if (config.airportsBlackList) {
		config.airportsBlackList = config.airportsBlackList instanceof Array ? new Set<string>(config.airportsBlackList) : undefined;
	}

	// State object that has been stored in `localStorage` in the past.
	const stateFromCache = !config.disableCaching ? getCachedState() : null;

	// New state object that will be used as the initial state for the new redux-store.
	let preloadedState = {
		...initialState,
		system: configReducer(systemState, config)
	};

	preloadedState = fillStateFromCache(preloadedState, stateFromCache);

	const sagaMiddleware = createSagaMiddleware();

	middlewares.push(sagaMiddleware);

	// Thunk middleware allows us to create functions instead of plain objects in action-creators (for async purposes).
	// @see https://github.com/gaearon/redux-thunk#motivation
	// The redux 4 typings explode (`TS2589: Type instantiation is excessively deep`)
	// when the store generics are inferred together with the middleware enhancer chain,
	// so the call is made untyped and the result is narrowed back to the app store.
	const store = (createStore as any)(
		rootReducer,
		preloadedState,
		applyMiddleware(...middlewares)
	) as Store<ApplicationState>;

	sagaMiddleware.run(rootSaga);

	if (!store.getState().form.segments.length) {
		store.dispatch(addSegment());
	}
	else {
		store.getState().form.segments.forEach((segment, index) => {
			getDatesAvailability(store.dispatch, store.getState, index);
		});
	}

	if (store.getState().system.defaultReturnDate && store.getState().form.segments.length < SEGMENTS_COUNT_RT) {
		store.dispatch(addSegment());
	}

	const state = store.getState();

	if ((!!state.system.routingGrid || state.system.mode === ApplicationMode.WEBSKY) && !state.form.gridAutocomplete['default'].length) {
		store.dispatch(runAutocompleteRequest('', AutocompleteFieldType.Departure, 0));
	}

	let defaultDepartureIATA = '',
		defaultArrivalIATA = '';

	if (!state.form.segments[0].autocomplete.departure.airport) {
		// Pre-loading departure airport by specified IATA or airport object.
		if (state.system.defaultDepartureAirport) {
			if (typeof state.system.defaultDepartureAirport === 'string') {
				store.dispatch(loadAirportForAutocomplete(state.system.defaultDepartureAirport, AutocompleteFieldType.Departure));

				defaultDepartureIATA = state.system.defaultDepartureAirport;
			}
			else if (typeof state.system.defaultDepartureAirport === 'object') {
				store.dispatch(setSelectedAirport(state.system.defaultDepartureAirport, AutocompleteFieldType.Departure));

				defaultDepartureIATA = state.system.defaultDepartureAirport.IATA;
			}
		}
		// Pre-loading nearest airport (loaded by IP-address) as the departure airport.
		else if (state.system.useNearestAirport) {
			store.dispatch(loadNearestAirportForAutocomplete(AutocompleteFieldType.Departure));
		}
	}

	if (!state.form.segments[0].autocomplete.arrival.airport) {
		if (state.system.defaultArrivalAirport) {
			if (typeof state.system.defaultArrivalAirport === 'string') {
				store.dispatch(loadAirportForAutocomplete(state.system.defaultArrivalAirport, AutocompleteFieldType.Arrival));

				defaultArrivalIATA = state.system.defaultArrivalAirport;
			}
			else if (typeof state.system.defaultArrivalAirport === 'object') {
				store.dispatch(setSelectedAirport(state.system.defaultArrivalAirport, AutocompleteFieldType.Arrival));

				defaultArrivalIATA = state.system.defaultArrivalAirport.IATA;
			}
		}
	}

	if (defaultArrivalIATA && defaultDepartureIATA) {
		getDatesAvailability(store.dispatch, store.getState, 0, defaultDepartureIATA, defaultArrivalIATA);
	}

	if (!state.form.additional.classType) {
		store.dispatch(setClassType(state.system.defaultServiceClass));
	}

	if (state.system.defaultReturnDate && !state.form.segments[1].departureDate.date) {
		const returnDate = moment(state.system.defaultReturnDate).locale(state.system.locale);

		store.dispatch(selectDate(returnDate, 1));
		store.dispatch(setRouteType(RouteType.RT));
	}

	if (state.system.defaultDepartureDate && !state.form.segments[0].departureDate.date) {
		const departureDate = moment(state.system.defaultDepartureDate).locale(state.system.locale);

		store.dispatch(selectDate(departureDate, 0));
	}

	if (getTotalPassengersCount(state) === 0) {
		const passengers = state.system.defaultPassengers;

		for (const type in passengers) {
			if (passengers.hasOwnProperty(type)) {
				store.dispatch(setCounter(passengers[type], type as PassengerType));
			}
		}
	}

	return store;
};
