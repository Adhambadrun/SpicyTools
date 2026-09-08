import * as React from 'react';
import { connect } from 'react-redux';
import DepartureDatepicker from './Datepicker/Departure';
import ReturnDatepicker from './Datepicker/Return';
import {
	getReturnHighlightedDates,
	getSegmentHighlightedDates,
	HighlightedDatesGroup
} from '../../../store/form/segments/dates/selectors';
import {
	ApplicationState, CommonThunkAction, DatepickerFieldType, DatepickerState, RouteType, SegmentState,
	SystemState
} from '../../../state';
import {
	DatepickerAction,
	datepickerChange,
	setAvailableDates
} from '../../../store/form/segments/dates/actions';
import { Moment } from 'moment';
import { i18n } from '../../../i18n';
import { isCR, isRT } from '../../../store/form/selectors';
import { setRouteType } from '../../../store/form/route/actions';

interface StateProps {
	system: SystemState;
	showErrors: boolean;
	getSegmentHighlightedDates: HighlightedDatesGroup[][];
	getReturnHighlightedDates: HighlightedDatesGroup[];
	disableUnavailableDates: boolean;
	isCR: boolean;
	isRT: boolean;
	segments: SegmentState[];
}

interface Props {
	segmentId: number;
	datesIsNotOrder?: boolean;
	departureDatepicker: DatepickerState;
	returnDatepicker: DatepickerState;
}

interface DispatchProps {
	setAvailableDates: (availableDates: any, segmentId: number) => DatepickerAction;
	setRouteType: (type: RouteType) => CommonThunkAction;
	datepickerChange: (date: Moment, segmentId: number) => CommonThunkAction;
}

class DatesContainer extends React.Component<StateProps & DispatchProps & Props> {
	protected returnInput: HTMLInputElement = null;

	render(): React.ReactNode {
		const { disableUnavailableDates, departureDatepicker, system, showErrors, datepickerChange, isCR, isRT, segmentId, datesIsNotOrder, setRouteType, segments } = this.props;
		const DATEPICKER_SWITCH_DELAY = 20;

		let initialDate = departureDatepicker.date;

		if (segmentId >= 1 || isRT) {
			const firstDate = segments[0].departureDate.date;
			const currDate = segments[isRT ? 1 : segmentId].departureDate.date;

			initialDate = firstDate;

			if (
				firstDate &&
				currDate &&
				Math.round(currDate.diff(firstDate, 'months', true)) > 1
			) {
				initialDate = currDate;
			}
		}

		return <div className="widget-dates">
			<DepartureDatepicker
				showErrors={showErrors}
				wrongDatesOrder={datesIsNotOrder}
				locale={system.locale}
				date={departureDatepicker.date}
				isActive={departureDatepicker.isActive}
				selectDate={(date: Moment) => {
					datepickerChange(date, segmentId);

					if (system.autoFocusReturnDate && this.returnInput) {
						setTimeout(() => {
							this.returnInput.focus();
						}, DATEPICKER_SWITCH_DELAY);
					}
				}}
				highlightDates={this.props.getSegmentHighlightedDates[segmentId]}
				specialDate={isRT ? segments[1].departureDate.date : segments[segmentId].departureDate.date}
				popperPlacement={isCR ? 'bottom-end' : 'bottom-start'}
				placeholder={i18n(isCR ? 'dateDeparture' : 'dateTo')}
				segmentId={segmentId}
				openToDate={isCR ? initialDate : null}
				disableUnavailableDates={disableUnavailableDates}
			/>

			{ !isCR ?
				<ReturnDatepicker
					locale={system.locale}
					date={isRT ? segments[1].departureDate.date : null}
					isActive={isRT}
					openToDate={initialDate}
					selectDate={datepickerChange}
					highlightDates={this.props.getReturnHighlightedDates}
					getRef={(input: HTMLInputElement): any => (this.returnInput = input)}
					specialDate={isRT ? segments[0].departureDate.date : null}
					popperPlacement="bottom-end"
					placeholder={i18n('dateBack')}
					segmentId={isRT ? 1 : segmentId}
					setRouteType={setRouteType}
					disableUnavailableDates={disableUnavailableDates}
				/> : null }
		</div>;
	}
}

const mapStateToProps = (state: ApplicationState): StateProps => {
	return {
		system: state.system,
		showErrors: state.form.showErrors,
		disableUnavailableDates: state.system.disableUnavailableDates,
		isCR: isCR(state),
		isRT: isRT(state),
		segments: state.form.segments,
		getSegmentHighlightedDates: getSegmentHighlightedDates(state),
		getReturnHighlightedDates: getReturnHighlightedDates(state)
	};
};

const mapActionsToProps = {
	setAvailableDates,
	setRouteType,
	datepickerChange
};

export default connect(mapStateToProps, mapActionsToProps)(DatesContainer);
