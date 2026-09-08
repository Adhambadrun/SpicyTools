import { Action, Reducer } from 'redux';
import { BATCH_ACTIONS, BatchedAction } from './actions';
import { ApplicationState } from '../../state';

export const batchActionsReducer = (reducer: Reducer<ApplicationState>): Reducer<ApplicationState> => {
	return (state: ApplicationState, action: BatchedAction|Action): ApplicationState => {
		switch (action.type) {
			case BATCH_ACTIONS:
				return (action as BatchedAction).payload.reduce(reducer, state);

			default:
				return reducer(state, action);
		}
	};
};
