import { ApplicationState, ServiceClass, SystemState } from '../../../state';
import { createSelector } from 'reselect';
import { getConfig, isCR } from '../selectors';

export const getClassType = (state: ApplicationState): ServiceClass => {
	return state.form.additional.classType;
};

export const vicinityDatesSelect = (state: ApplicationState): boolean => {
	return state.form.additional.vicinityDates;
};

export const directFlightSelect = (state: ApplicationState): boolean => {
	return state.form.additional.directFlight;
};

export const isOneAdditionalEnabled = createSelector(
	[ getConfig, isCR ],
	(config: SystemState, isCR: boolean): boolean => config.directOnly || config.vicinityDatesMode && !isCR
);
