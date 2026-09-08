import * as moment from 'moment';
import { Moment } from 'moment';

import { AutocompleteFieldType, CommonThunkAction, RouteType } from '../../../state';
import { HotDeal, airportFromIATA } from '../../../deals';
import { setSelectedAirport } from '../segments/autocomplete/actions';
import { selectDate } from '../segments/dates/actions';
import { setRouteType } from '../route/actions';
import { startSearch } from '../actions';
import { eventTap, SearchFormEvent } from '../../../services/eventLogger';

const toMoment = (date: string): Moment => (date ? moment(date, 'YYYY-MM-DD') : null);

/**
 * Drop a hot deal straight into the search form and run it.
 *
 * Round trips reuse the same shape the UI builds by hand: segment 0 flies
 * out, segment 1 flies back with the airports mirrored.
 */
export const applyDeal = (deal: HotDeal): CommonThunkAction => {
	return (dispatch, getState): void => {
		const state = getState();
		const routeType = deal.returnDate ? RouteType.RT : RouteType.OW;

		const departure = airportFromIATA(deal.departure, deal.departureName);
		const arrival = airportFromIATA(deal.arrival, deal.arrivalName);

		if (state.form.routeType !== routeType) {
			dispatch(setRouteType(routeType));
		}

		dispatch(setSelectedAirport(departure, AutocompleteFieldType.Departure, 0));
		dispatch(setSelectedAirport(arrival, AutocompleteFieldType.Arrival, 0));

		const departDate = toMoment(deal.departDate);

		if (departDate) {
			dispatch(selectDate(departDate, 0));
		}

		if (routeType === RouteType.RT) {
			dispatch(setSelectedAirport(arrival, AutocompleteFieldType.Departure, 1));
			dispatch(setSelectedAirport(departure, AutocompleteFieldType.Arrival, 1));

			const returnDate = toMoment(deal.returnDate);

			if (returnDate) {
				dispatch(selectDate(returnDate, 1));
			}
		}

		eventTap(SearchFormEvent.DealApplied, `${deal.departure}-${deal.arrival}`);

		dispatch(startSearch());
	};
};
