import { combineReducers } from 'redux';
import form from './form/reducer';
import system from './system/reducer';
import { ApplicationState } from '../state';
import { batchActionsReducer } from './batching/reducers';

export default batchActionsReducer(combineReducers<ApplicationState>({
	form,
	system
}));
