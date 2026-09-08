import * as React from 'react';
import * as moment from 'moment';
import { Moment } from 'moment';

import UIDatepicker from '../../UI/Datepicker';
import MobileHeader from '../../UI/MobileHeader';
import { CommonThunkAction, DatepickerFieldType, Language, RouteType } from '../../../state';
import { HighlightedDatesGroup } from '../../../store/form/segments/dates/selectors';
import { i18n } from '../../../i18n';

interface Props {
	showErrors?: boolean;
	locale: Language;
	date: Moment;
	isActive: boolean;
	openToDate?: Moment;
	highlightDates: HighlightedDatesGroup[];
	specialDate: Moment;
	segmentId: number;
	popperPlacement: string;
	placeholder: string;
	wrongDatesOrder?: boolean;
	disableUnavailableDates?: boolean;

	setRouteType?: (type: RouteType) => CommonThunkAction;
	selectDate: (date: Moment, segmentId: number) => any;
	getRef?: (input: any) => any;
}

export default class Datepicker extends React.Component<Props> {
	static defaultProps: Partial<Props> = {
		showErrors: false,
		highlightDates: [],
		popperPlacement: 'bottom-start'
	};

	protected type: DatepickerFieldType = null;
	protected datepickerRef: any = null;
	protected tooltipText = '';
	protected showErrors = false;
	protected isDisableable = false;

	constructor(props: Props) {
		super(props);

		this.onChangeHandler = this.onChangeHandler.bind(this);
		this.closeDatepicker = this.closeDatepicker.bind(this);
	}

	/**
	 * Select date.
	 *
	 * @param {Moment} date
	 */
	onChangeHandler(date: Moment): void {
		this.props.selectDate(date, this.props.segmentId);
	}

	shouldComponentUpdate(nextProps: Props): boolean {
		const { isActive, date, highlightDates, specialDate, showErrors, locale, popperPlacement } = this.props;

		return (
			isActive !== nextProps.isActive ||
			date !== nextProps.date ||
			locale !== nextProps.locale ||
			specialDate !== nextProps.specialDate ||
			showErrors !== nextProps.showErrors ||
			highlightDates !== nextProps.highlightDates ||
			popperPlacement !== nextProps.popperPlacement
		);
	}

	closeDatepicker(): void {
		if (this.datepickerRef && this.datepickerRef.calendar) {
			this.datepickerRef.calendar.setOpen(false);
		}
	}

	renderInner(): React.ReactNode {
		const mobileHeaderClassName = `widget-ui-datepicker__header widget-ui-datepicker__header_${this.type}`,
						placeholder = this.props.placeholder;

		return <MobileHeader className={mobileHeaderClassName} title={placeholder} onClose={this.closeDatepicker}/>;
	}

	render(): React.ReactNode {
		const {
			selectDate,
			getRef,
			locale,
			date,
			isActive,
			showErrors,
			specialDate,
			openToDate,
			highlightDates,
			popperPlacement,
			placeholder,
			wrongDatesOrder,
			setRouteType,
			disableUnavailableDates
		} = this.props;

		const
			minDate = moment(),
			maxDate = moment().add(1, 'years'),
			datesIsNotInOrderText = i18n('datesNotInOrderError');

		// The datepicker converts `openToDate` with `new Date(...)`, and an empty
		// segment hands it `null` — which is a *valid* Date (the epoch) rather
		// than "no date", so the calendar renders a December-1969 month and
		// throws on an invalid moment. Only a real, parseable date may be passed;
		// anything else makes react-datepicker open on today, which is what an
		// untouched form wants.
		const openedDate = openToDate && moment.isMoment(openToDate) && openToDate.isValid() ? openToDate : null;

		return <div className="widget-dates__col">
			<UIDatepicker
				isDisableable={this.isDisableable}
				ref={(calendar: any) => (this.datepickerRef = calendar)}
				type={this.type}
				isActive={isActive}
				onChange={this.onChangeHandler}
				locale={locale}
				date={date}
				openToDate={openedDate}
				minDate={minDate}
				maxDate={maxDate}
				getRef={getRef}
				highlightDates={highlightDates}
				selectDate={selectDate}
				popperPlacement={popperPlacement}
				specialDate={specialDate}
				tooltipIsActive={this.showErrors && showErrors && (!date || wrongDatesOrder)}
				tooltipText={wrongDatesOrder ? datesIsNotInOrderText : this.tooltipText}
				inputProps={{ placeholder: placeholder }}
				setRouteType={setRouteType ? setRouteType : null}
				onlyHighlightedDates={disableUnavailableDates}
			>
				{this.renderInner()}
			</UIDatepicker>
		</div>;
	}
}
