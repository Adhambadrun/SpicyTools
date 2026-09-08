import * as React from 'react';
import * as classnames from 'classnames';
import { Action, AnyAction, bindActionCreators, Dispatch } from 'redux';
import { connect } from 'react-redux';
import { Checkbox } from '../../UI/Checkbox';
import {
	vicinityDatesSelect,
	directFlightSelect,
	isOneAdditionalEnabled
} from '../../../store/form/additional/selector';
import { i18n } from '../../../i18n';
import { ApplicationMode, ApplicationState, CommonThunkAction, RouteType, ServiceClass } from '../../../state';
import {
	BooleanAction, SetClassAction, setClassType,
	vicinityDatesAction,
	directFlightAction
} from '../../../store/form/additional/actions';
import { setRouteType } from '../../../store/form/route/actions';
import { isCR } from '../../../store/form/selectors';
import UIDropdown from '../../UI/Dropdown';
import { eventTap, SearchFormEvent } from '../../../services/eventLogger';

interface StateProps {
	vicinityDatesSelect: boolean;
	directFlightSelect: boolean;
	isDirectEnabled: boolean;
	isVicinityDaysModeEnabled: boolean;
	isOneAdditionalOptionEnabled: boolean;
	vicinityDays: number;
	widgetMode: ApplicationMode;
	isCR: boolean;
	onFallbackClick: () => void;
}

interface DispatchProps {
	setClassType: typeof setClassType;
	vicinityDatesAction: typeof vicinityDatesAction;
	directFlightAction: typeof directFlightAction;
	setRouteType: (type: RouteType) => CommonThunkAction;
}

class AdditionalOptionsContainer extends React.Component<StateProps & DispatchProps> {
	constructor(props: StateProps & DispatchProps) {
		super(props);

		this.changeRouteType = this.changeRouteType.bind(this);
		this.directFlightsTrigger = this.directFlightsTrigger.bind(this);
		this.vicinityDatesTrigger = this.vicinityDatesTrigger.bind(this);
	}

	vicinityDatesTrigger(): void {
		const {vicinityDatesSelect, vicinityDatesAction} = this.props;

		eventTap(SearchFormEvent.VicinityDates, !vicinityDatesSelect);
		vicinityDatesAction();
	}

	renderVicinityDates(): React.ReactNode {
		const { vicinityDatesSelect, vicinityDays } = this.props;
		const NUM_OF_DAYS_PLURAL = 5;
		let dayLabel: string;

		dayLabel = vicinityDays > 1 ? i18n((vicinityDays < NUM_OF_DAYS_PLURAL ? 'additional_vicinityDates_days' : 'additional_vicinityDates_days_5')) : i18n('additional_vicinityDates_day');

		const label = i18n('additional_vicinityDates').replace('[%-days-%]', vicinityDays.toString()).replace('[%-dayLabel-%]', dayLabel);

		return <Checkbox
			id="vicinity"
			label={label}
			trigger={this.vicinityDatesTrigger}
			checked={vicinityDatesSelect}
		/>;
	}

	changeRouteType(): void {
		if (this.props.isCR) {
			this.props.setRouteType(RouteType.OW);
		}
		else {
			this.props.setRouteType(RouteType.CR);
		}
	}

	directFlightsTrigger(): void {
		const {directFlightAction, directFlightSelect} = this.props;

		eventTap(SearchFormEvent.DirectFlight, !directFlightSelect);
		directFlightAction();
	}

	renderDirect(): React.ReactNode {
		const { directFlightSelect } = this.props;
		const label = i18n('additional_directFlight');

		return <Checkbox
			id="directCheckbox"
			label={label}
			trigger={this.directFlightsTrigger}
			checked={directFlightSelect}
		/>;
	}

	renderDropdownTrigger(): React.ReactNode {
		return (
			<div className="widget-ui-select__toggle">{i18n('moreOptions')}</div>
		);
	}

	renderDropdownContent(): React.ReactNode {
		const { isCR, isDirectEnabled, isVicinityDaysModeEnabled } = this.props;

		return (
			<div className="widget-ui-select__dropdown">
				{!isCR && isVicinityDaysModeEnabled ? this.renderVicinityDates() : null}
				{isDirectEnabled ? this.renderDirect() : null}
			</div>
		);
	}

	renderSelect(): React.ReactNode {
		return (
			<div className="widget-additionalOptions__checkboxes-options widget-ui-select">
				<UIDropdown
					triggerElement={this.renderDropdownTrigger()}
					contentElement={this.renderDropdownContent()}
				/>
			</div>
		);
	}

	renderFallbackButton(): React.ReactNode {
		return this.props.onFallbackClick && (
			<div className="widget-additionalOptions__checkboxes-fallbackButton" onClick={this.props.onFallbackClick}>
				<span className="widget-additionalOptions__checkboxes-fallbackButton__text">{i18n('additional_fallbackButton')}</span>
			</div>
		);
	}

	render(): React.ReactNode {
		const { widgetMode, isCR, isDirectEnabled, isVicinityDaysModeEnabled, isOneAdditionalOptionEnabled } = this.props;

		return widgetMode === ApplicationMode.SPICY && (
			<div className="widget-additionalOptions">
				<div className="widget-additionalOptions__checkboxes">
					{!isCR && isVicinityDaysModeEnabled ? this.renderVicinityDates() : null}
					{isDirectEnabled ? this.renderDirect() : null}
				</div>

				<div className="widget-additionalOptions__checkboxes widget-additionalOptions__checkboxes_spicy">
					{this.renderFallbackButton()}
					{isOneAdditionalOptionEnabled ? this.renderSelect() : null}
				</div>

				<div className={classnames('widget__routeTypeSwitch', { widget__routeTypeSwitch_toCR: !isCR }, { widget__routeTypeSwitch_toOW: isCR })}>
					<span onClick={this.changeRouteType}>
						{i18n(isCR ? 'routeType_OW' : 'routeType_CR')}
					</span>
				</div>
			</div>
		);
	}
}

const mapStateToProps = (state: ApplicationState): StateProps => {
	return {
		vicinityDatesSelect: vicinityDatesSelect(state),
		directFlightSelect: directFlightSelect(state),
		isOneAdditionalOptionEnabled: isOneAdditionalEnabled(state),
		vicinityDays: state.system.vicinityDays,
		widgetMode: state.system.mode,
		onFallbackClick: state.system.onFallbackClick,
		isCR: isCR(state),
		isDirectEnabled: state.system.directOnly,
		isVicinityDaysModeEnabled: state.system.vicinityDatesMode
	};
};

const mapActionsToProps = (dispatch: Dispatch<AnyAction, any>): DispatchProps => {
	return {
		setClassType: bindActionCreators(setClassType, dispatch),
		vicinityDatesAction: bindActionCreators(vicinityDatesAction, dispatch),
		directFlightAction: bindActionCreators(directFlightAction, dispatch),
		setRouteType: bindActionCreators(setRouteType, dispatch)
	};
};

export default connect(mapStateToProps, mapActionsToProps)(AdditionalOptionsContainer);
