import { Action } from 'redux';

export const BATCH_ACTIONS = 'BATCH_ACTIONS';

export interface BatchedAction extends Action {
	payload: Action[];
}

export const batchActions = (...actions: Action[]): BatchedAction => {
	return {
		type: BATCH_ACTIONS,
		payload: actions
	};
};
