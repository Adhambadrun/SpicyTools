import { createSelector } from 'reselect';
import { getIntermediateDates } from '../../../../utils';
import * as moment from 'moment';
import { ApplicationState, FormState } from '../../../../state';
import { Moment } from 'moment';
import { isCR, getForm, isRT } from '../../selectors';
import { AvailableDateResponse } from '../../../../services/responses/AvailableDates';
import { calendarHeat } from '../../../../services/spicytool';

const getReturnDate = (state: ApplicationState): Moment => isRT(state) && state.form.segments[1] ? state.form.segments[1].departureDate.date : null;
const getReturnAvailableDates = (state: ApplicationState): any => state.form.segments[0] && state.form.segments[0].returnDate ? state.form.segments[0].returnDate.availableDates : [];
const highlightAvailableDates = (state: ApplicationState): boolean => state.system.highlightAvailableDates;

const getDepartureDates = createSelector(
	[getForm, isCR],
	(form: FormState, isCR: boolean): Moment[] => {
		if (!isCR) {
			// A form with no segment yet (nothing mounted, or a host page that
			// dispatches before init) must not take the selectors down.
			return form.segments.length ? [form.segments[0].departureDate.date] : [];
		}

		return form.segments.map(segment => {
			return segment.departureDate.date;
		});
	}
);

/**
 * Get an array of MomentJS dates between the departure and the return date (for simple trip),
 * or dates between first and last departure dates (for complex route).
 */
export const getDatesBetweenDepartureAndReturn = createSelector(
	[getDepartureDates, getReturnDate, isCR],
	(departureDates?: Moment[], returnDate?: Moment, isCR?: boolean): Moment[] => {
		let result: Moment[] = [];

		if (isCR && departureDates) {
			let lastDepartureDate: Moment = null;

			departureDates.forEach(date => {
				if (date) {
					lastDepartureDate = date;
				}
			});

			result = getIntermediateDates(departureDates[0], lastDepartureDate);
		}
		else {
			// An untouched form hands this selector `departureDates = [null]`. Pushing
			// that on makes react-datepicker highlight the epoch (1 Jan 1970) and throw
			// "Invalid time value" while formatting it — only real moments may travel.
			if (departureDates && departureDates[0] && departureDates[0].isValid()) {
				if (returnDate) {
					result = getIntermediateDates(departureDates[0], returnDate, true);
				}
				else {
					result.push(departureDates[0]);
				}
			}
			else if (returnDate) {
				result.push(returnDate);
			}
		}

		return result;
	}
);

export interface HighlightedDatesGroup {
	[className: string]: Moment[];
}

/**
 * Join two arrays:
 * - dates with available flights
 * - dates between departure and arrival
 * - departure dates for complex trip
 *
 * @param {Array} availableDates
 * @param {Array} intermediateDates
 * @param {Boolean} highlightAvailableDates
 * @param {Array} departureDates
 * @returns {Array}
 */
const createHighlightedDates = (availableDates: any, intermediateDates: Moment[], highlightAvailableDates: boolean, departureDates?: Moment[], isCR?: boolean): HighlightedDatesGroup[] => {
	const result: HighlightedDatesGroup[] = [];

	// react-datepicker formats every highlight it is given; a single invalid
	// moment in the list is enough to take the whole calendar down, so drop
	// anything that is not a date before it gets there.
	const usable = (dates: Moment[]): Moment[] => (dates || []).filter(date => !!date && date.isValid());

	intermediateDates = usable(intermediateDates);
	departureDates = usable(departureDates);

	if (highlightAvailableDates && availableDates.length) {
		result.push({
			'react-datepicker__day--hasFlight': usable(availableDates.map(({ date }: any) => moment(date)))
		});

		// SpicyTool prices its calendar, so the cheap days can be graded on the
		// heat scale instead of only being marked "there is a flight".
		const heat = calendarHeat(availableDates);
		const groups: HighlightedDatesGroup = {};

		Object.keys(heat).forEach(date => {
			const className = `react-datepicker__day--${heat[date].heat}`;

			groups[className] = groups[className] || [];
			groups[className].push(moment(date));
		});

		Object.keys(groups).forEach(className => result.push({ [className]: groups[className] }));
	}

	if (intermediateDates.length) {
		result.push({
			'react-datepicker__day--highlighted': intermediateDates
		});
	}

	if (departureDates && departureDates.length > 1 && isCR) {
		result.push({
			'react-datepicker__day--selected': departureDates
		});
	}

	return result;
};

export const getAvailableDatesBySegments = (state: ApplicationState): AvailableDateResponse[][] => {
	return state.form.segments.map(segment => {
		return segment.departureDate.availableDates;
	});
};

export const getReturnHighlightedDates = createSelector(
	[getReturnAvailableDates, getDatesBetweenDepartureAndReturn, highlightAvailableDates],
	createHighlightedDates
);

export const getSegmentHighlightedDates = createSelector(
	[getAvailableDatesBySegments, getDatesBetweenDepartureAndReturn, highlightAvailableDates, getDepartureDates, isCR],
	(availableDates: AvailableDateResponse[][], intermediateDates: Moment[], highlightAvailableDates: boolean, departureDates?: Moment[], isCR?: boolean): HighlightedDatesGroup[][] => {
		return availableDates.map(date => {
			return createHighlightedDates(date, intermediateDates, highlightAvailableDates, departureDates, isCR);
		});
	}
);
