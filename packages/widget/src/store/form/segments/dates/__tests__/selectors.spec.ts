import * as moment from 'moment';
import { createStore } from 'redux';

import { getDatesBetweenDepartureAndReturn, getSegmentHighlightedDates } from '../selectors';
import { addSegment } from '../../actions';
import { ApplicationState, initialState } from '../../../../../state';
import rootReducer from '../../../../reducer';

/* global describe */
/* global it */
/* global expect */

/**
 * An empty search form has no departure date, and the widget used to hand
 * react-datepicker that `null` as a highlight: the calendar formatted it as a
 * date (the epoch) and then threw `RangeError: Invalid time value`, which took
 * the whole mount down. `SpicyTools.init()` on a page without a fare API hit
 * exactly this. Highlighting must survive an untouched form.
 */
describe('date highlights of an untouched segment', () => {
	const emptyFormStore = () => {
		const store = createStore(rootReducer);

		store.dispatch(addSegment() as any);

		return store;
	};

	it('produces no intermediate dates before a departure date is picked', () => {
		const state = emptyFormStore().getState() as ApplicationState;

		expect(state.form.segments[0].departureDate.date).toBeFalsy();
		expect(getDatesBetweenDepartureAndReturn(state)).toEqual([]);
	});

	it('hands react-datepicker highlight groups without invalid moments', () => {
		const state = emptyFormStore().getState() as ApplicationState;
		const groups = getSegmentHighlightedDates(state);

		expect(Array.isArray(groups)).toBe(true);

		groups.forEach(group => group.forEach(highlight => {
			Object.keys(highlight).forEach(className => {
				highlight[className].forEach((date: any) => expect(date.isValid()).toBe(true));
			});
		}));
	});

	it('still highlights the interval once a departure date exists', () => {
		const store = createStore(rootReducer);

		store.dispatch(addSegment() as any);

		const withDates = {
			...store.getState(),
			form: {
				...store.getState().form,
				segments: store.getState().form.segments.map((segment, index) => ({
					...segment,
					departureDate: {
						...segment.departureDate,
						date: index === 0 ? moment('2026-10-09') : moment('2026-10-16')
					}
				}))
			}
		} as ApplicationState;

		expect(getDatesBetweenDepartureAndReturn(withDates).length).toBeGreaterThan(0);
	});

	it('keeps the initial state shape intact (no segment, no crash)', () => {
		const state = { ...initialState, form: { ...initialState.form, segments: [] } } as ApplicationState;

		expect(() => getDatesBetweenDepartureAndReturn(state)).not.toThrow();
	});
});
