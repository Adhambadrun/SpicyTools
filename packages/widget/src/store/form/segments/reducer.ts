import {
	ADD_SEGMENT, AIRPORT_SELECTED, AUTOCOMPLETE_LOADING_FINISHED, AUTOCOMPLETE_LOADING_STARTED,
	AUTOCOMPLETE_PUSH_TO_PREVIOUS,
	AUTOCOMPLETE_SUGGESTIONS_CHANGED,
	DELETE_SEGMENT, REMOVE_COMPLEX_SEGMENTS,
	SELECT_DATE, SET_AVAILABLE_DATES, SET_NEAR_SUGGESTED_AIRPORT, SET_SEGMENTS, TOGGLE_DATEPICKER
} from '../../actions';
import { DatepickerFieldType, SegmentState, segmentState } from '../../../state';
import { datesMainReducer } from './dates/reducer';
import { autocompleteMainReducer } from './autocomplete/reducer';
import { AutocompleteAction } from './autocomplete/actions';
import { DatepickerAction } from './dates/actions';

const autocompleteReducer = (state: SegmentState[], action: AutocompleteAction): SegmentState[] => {
	const segmentId = action.segmentId || 0;

	return state.map((segment, index) => {
		if (index === segmentId) {
			return {
				...segment,
				autocomplete: autocompleteMainReducer(segment.autocomplete, action)
			};
		}
		else {
			return segment;
		}
	});
};

const datesReducer = (state: SegmentState[], action: DatepickerAction): SegmentState[] => {
	const segmentId = action.segmentId || 0;

	return state.map((segment, index) => {
		if (index === segmentId) {
			if (action.payload.dateType === DatepickerFieldType.Return) {
				return {
					...segment,
					returnDate: datesMainReducer(segment.returnDate, action)
				};
			}
			else {
				return {
					...segment,
					departureDate: datesMainReducer(segment.departureDate, action)
				};
			}
		}
		else {
			return segment;
		}
	});
};

export default (state: SegmentState[] = [segmentState], action: any): SegmentState[] => {
	switch(action.type) {
		case AUTOCOMPLETE_LOADING_STARTED:
		case AUTOCOMPLETE_LOADING_FINISHED:
		case AUTOCOMPLETE_SUGGESTIONS_CHANGED:
		case AIRPORT_SELECTED:
		case AUTOCOMPLETE_PUSH_TO_PREVIOUS:
		case SET_NEAR_SUGGESTED_AIRPORT:
			return autocompleteReducer(state, action);

		case TOGGLE_DATEPICKER:
		case SELECT_DATE:
		case SET_AVAILABLE_DATES:
			return datesReducer(state, action);

		case ADD_SEGMENT:
			return [...state, segmentState];

		case DELETE_SEGMENT:
			return [...state.splice(0, state.length - 1)];

		case REMOVE_COMPLEX_SEGMENTS:
			return [state[0]];

		case SET_SEGMENTS:
			return [...action.segments];
	}

	return state;
};
