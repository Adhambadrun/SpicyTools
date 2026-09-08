import * as React from 'react';
import { connect } from 'react-redux';
import { AnyAction, bindActionCreators, Dispatch } from 'redux';
import {
	changeAutocompleteSuggestions,
	selectAirport,
	runAutocompleteRequest,
	swapAirports, AutocompleteAction
} from '../../../store/form/segments/autocomplete/actions';

import DepartureAutocomplete from './Autocomplete/Departure';
import ArrivalAutocomplete from './Autocomplete/Arrival';
import {
	getDefaultOptionsGroup, DefaultOptionGroup, getSuggestionOptions,
	suggestionsToOptionsArray
} from '../../../store/form/selectors';
import {
	ApplicationMode, ApplicationState, AutocompleteFieldState, AutocompleteFieldType, CommonThunkAction,
	GridAutocompleteState, SystemState
} from '../../../state';
import { AutocompleteOption } from '../../../services/models/AutocompleteOption';

interface StateProps {
	defaultOptionsGroup: DefaultOptionGroup[][];
	showErrors: boolean;
	system: SystemState;
	gridAutocomplete: GridAutocompleteState;
	isGridMode: boolean;
}

interface DispatchProps {
	selectAirport: (airport: any, autocompleteType: AutocompleteFieldType, segmentId: number) => CommonThunkAction;
	runAutocompleteRequest: typeof runAutocompleteRequest;
	changeAutocompleteSuggestions: (suggestions: any[], autocompleteType: AutocompleteFieldType) => AutocompleteAction;
	swapAirports: (segmentId: number) => CommonThunkAction;
}

interface Props {
	segmentId: number;
	departureAutocomplete: AutocompleteFieldState;
	arrivalAutocomplete: AutocompleteFieldState;
}

class AutocompleteContainer extends React.Component<StateProps & DispatchProps & Props> {
	protected arrivalInput: HTMLInputElement = null;

	getAutocomplete(type: AutocompleteFieldType): AutocompleteOption[] {
		if (this.props.isGridMode || this.props.system.mode === ApplicationMode.WEBSKY) {
			if (
				type === AutocompleteFieldType.Departure ||
				!this.props.departureAutocomplete.airport
			) {
				return suggestionsToOptionsArray(this.props.gridAutocomplete['default']);
			}

			if (this.props.gridAutocomplete.hasOwnProperty(this.props.departureAutocomplete.airport.IATA)) {
				return suggestionsToOptionsArray(this.props.gridAutocomplete[this.props.departureAutocomplete.airport.IATA]);
			}
		}
		else {
			return getSuggestionOptions(type === AutocompleteFieldType.Arrival ? this.props.arrivalAutocomplete : this.props.departureAutocomplete);
		}

		return [];
	}

	render(): React.ReactNode {
		let sameAirportsError = false;

		const {
			departureAutocomplete,
			defaultOptionsGroup,
			arrivalAutocomplete,
			system,
			showErrors,

			swapAirports,
			changeAutocompleteSuggestions,
			runAutocompleteRequest,
			selectAirport,
			segmentId
		} = this.props;

		const departureOptions = this.getAutocomplete(AutocompleteFieldType.Departure),
				arrivalOptions = this.getAutocomplete(AutocompleteFieldType.Arrival);

		if (
			departureAutocomplete.airport && arrivalAutocomplete.airport &&
			departureAutocomplete.airport.IATA === arrivalAutocomplete.airport.IATA
		) {
			sameAirportsError = true;
		}

		return <div className="widget-airports">
			<DepartureAutocomplete
				showErrors={showErrors}
				sameAirportsError={sameAirportsError}
				isLoading={departureAutocomplete.isLoading}
				suggestions={departureOptions}
				segmentId={segmentId}
				optionsGroup={defaultOptionsGroup[segmentId]}
				airport={departureAutocomplete.airport}
				swapAirports={swapAirports}
				changeAutocompleteSuggestions={changeAutocompleteSuggestions}
				sendAutocompleteRequest={runAutocompleteRequest}
				isGridMode={!!system.routingGrid || system.mode === ApplicationMode.WEBSKY}
				readOnly={system.readOnlyAutocomplete}
				selectAirport={(airport: any, autocompleteType: AutocompleteFieldType, segmentId: number): void => {
					selectAirport(airport, autocompleteType, segmentId);

					if (system.autoFocusArrivalAirport && this.arrivalInput) {
						this.arrivalInput.focus();
					}
				}}
			/>

			<ArrivalAutocomplete
				showErrors={showErrors}
				sameAirportsError={sameAirportsError}
				segmentId={segmentId}
				isLoading={arrivalAutocomplete.isLoading}
				suggestions={arrivalOptions}
				optionsGroup={defaultOptionsGroup[segmentId]}
				airport={arrivalAutocomplete.airport}
				swapAirports={swapAirports}
				changeAutocompleteSuggestions={changeAutocompleteSuggestions}
				sendAutocompleteRequest={runAutocompleteRequest}
				selectAirport={selectAirport}
				isGridMode={!!system.routingGrid || system.mode === ApplicationMode.WEBSKY}
				readOnly={system.readOnlyAutocomplete}
				forceAutocompleteFetch={system.autoFocusArrivalAirport}
				getRef={(reactSelect: any): void => reactSelect ? (this.arrivalInput = reactSelect.input) : null}
			/>
		</div>;
	}
}

const mapStateToProps = (state: ApplicationState): StateProps => {
	return {
		defaultOptionsGroup: getDefaultOptionsGroup(state),
		showErrors: state.form.showErrors,
		system: state.system,
		gridAutocomplete: state.form.gridAutocomplete,
		isGridMode: !!state.system.routingGrid
	};
};

const mapActionsToProps = (dispatch: Dispatch<AnyAction, any>): DispatchProps => {
	return {
		changeAutocompleteSuggestions: bindActionCreators(changeAutocompleteSuggestions, dispatch),
		selectAirport: bindActionCreators(selectAirport, dispatch),
		runAutocompleteRequest: bindActionCreators(runAutocompleteRequest, dispatch),
		swapAirports: bindActionCreators(swapAirports, dispatch)
	};
};

export default connect(mapStateToProps, mapActionsToProps)(AutocompleteContainer);
