import * as React from 'react';
import { connect } from 'react-redux';
import {
	getPassengersTitle,
	getPassengersArray,
	getTotalPassengersCount,
	getPassengersCounterAvailability, PassengersCounterAvailability
} from '../../../store/form/passengers/selectors';
import Selector from './Passengers/Selector';
import { getClassType } from '../../../store/form/additional/selector';
import {
	ApplicationMode,
	ApplicationState,
	CLASS_TYPES,
	PassengerState,
	ServiceClass
} from '../../../state';
import { addPassenger, removePassenger, setCounter } from '../../../store/form/passengers/actions';
import { setClassType } from '../../../store/form/additional/actions';

interface OwnProps {
	renderSelector?: RenderPassengerSelector;
}

interface StateProps {
	counterAvailability: PassengersCounterAvailability;
	passengers: PassengerState[];
	title: string;
	totalPassengersCount: number;
	selectedClass: ServiceClass;
	classOptions: string[];
	widgetMode: ApplicationMode;
}

interface DispatchProps {
	addPassenger: typeof addPassenger;
	removePassenger: typeof removePassenger;
	setCounter: typeof setCounter;
	setClassType: typeof setClassType;
}

type Props = OwnProps & StateProps & DispatchProps;

export type RenderPassengerSelector = (props: StateProps & DispatchProps) => React.ReactNode;

class PassengersContainer extends React.Component<Props> {
	render(): React.ReactNode {
		const {
			renderSelector,
			passengers,
			counterAvailability,
			title,
			totalPassengersCount,
			addPassenger,
			removePassenger,
			classOptions,
			setClassType,
			selectedClass,
			widgetMode
		} = this.props;

		return typeof renderSelector === 'function' ? (
			renderSelector({
				counterAvailability,
				passengers,
				title,
				totalPassengersCount,
				selectedClass,
				classOptions,
				addPassenger,
				removePassenger,
				setCounter,
				setClassType,
				widgetMode
			})
		) : (
			<Selector
				passengers={passengers}
				title={title}
				counterAvailability={counterAvailability}
				totalPassengersCount={totalPassengersCount}
				removePassenger={removePassenger}
				addPassenger={addPassenger}
				setClassType={setClassType}
				classOptions={classOptions}
				selectedClass={selectedClass}
				isSpicyMode={widgetMode === ApplicationMode.SPICY}
			/>
		);
	}
}

const mapStateToProps = (state: ApplicationState): StateProps => {
	return {
		counterAvailability: getPassengersCounterAvailability(state),
		passengers: getPassengersArray(state),
		title: getPassengersTitle(state),
		totalPassengersCount: getTotalPassengersCount(state),
		selectedClass: getClassType(state),
		classOptions: CLASS_TYPES,
		widgetMode: state.system.mode
	};
};

const mapActionsToProps = {
	addPassenger,
	removePassenger,
	setCounter,
	setClassType
};

export default connect(mapStateToProps, mapActionsToProps)(PassengersContainer);
