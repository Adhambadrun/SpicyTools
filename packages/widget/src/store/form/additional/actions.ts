import {
	SET_CLASS_TYPE,
	TOGGLE_VICINITY_DATES,
	TOGGLE_DIRECT_FLIGHT
} from '../../actions';
import { ServiceClass } from '../../../state';
import { Action } from 'redux';
import { eventTap, SearchFormEvent } from '../../../services/eventLogger';

export interface SetClassAction extends Action {
	payload: ServiceClass;
}

export interface BooleanAction extends Action {
	payload: boolean;
}

export const setClassType = (classType: ServiceClass): SetClassAction => {
	eventTap(SearchFormEvent.ServiceClass, classType);

	return {
		type: SET_CLASS_TYPE,
		payload: classType
	};
};

export const vicinityDatesAction = (): Action => {
	return {
		type: TOGGLE_VICINITY_DATES
	};
};

export const directFlightAction = (): Action => {
	return {
		type: TOGGLE_DIRECT_FLIGHT
	};
};
