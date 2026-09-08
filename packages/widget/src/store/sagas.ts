import { all } from 'redux-saga/effects';
import runAutocompleteSaga from './form/segments/autocomplete/sagas';

export default function* rootSaga() {
	yield all([
		runAutocompleteSaga()
	]);
}
