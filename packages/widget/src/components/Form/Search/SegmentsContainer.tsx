import * as React from 'react';
import { connect } from 'react-redux';
import * as classnames from 'classnames';

import Segment from './Segment';
import {
	ApplicationState,
	SegmentState,
	MAX_SEGMENTS_COUNT,
	CommonThunkAction,
	ArrivalSuggestAirport
} from '../../../state';
import { continueRoute, deleteSegment } from '../../../store/form/segments/actions';
import { i18n } from '../../../i18n';
import { getArrivalSuggestAirport, isCR, isRT } from '../../../store/form/selectors';
import { selectAirport } from '../../../store/form/segments/autocomplete/actions';

interface StateProps {
	segments: SegmentState[];
	isCR: boolean;
	isRT: boolean;
	arrivalSuggestAirport: ArrivalSuggestAirport;
}

interface DispatchProps {
	continueRoute: typeof continueRoute;
	deleteSegment: typeof deleteSegment;
	selectAirport: typeof selectAirport;
}

class SegmentsContainer extends React.Component<StateProps & DispatchProps> {
	constructor(props: StateProps & DispatchProps) {
		super(props);

		this.continueRoute = this.continueRoute.bind(this);
	}

	continueRoute(): void {
		this.props.continueRoute();
	}

	renderFirstSegment(): React.ReactNode {
		const { segments, isRT, arrivalSuggestAirport, selectAirport } = this.props;

		return (
			<Segment
				segment={segments[0]}
				segmentId={0}
				canBeRemoved={false}
				showDatesError={false}
				returnDate={isRT ? segments[1].departureDate : null}
				arrivalSuggestAirport={arrivalSuggestAirport}
				selectAirport={selectAirport}
			/>
		);
	}

	renderAllSegment(): React.ReactNode {
		const { segments, isCR, deleteSegment } = this.props;

		return segments.map((segment: SegmentState, index: number) => {
			return (
				<Segment
					segment={segment}
					segmentId={index}
					key={index}
					removeSegment={deleteSegment}
					canBeRemoved={segments.length > 1 && segments.length - 1 === index && isCR}
					showDatesError={index > 0 && segment.departureDate.date && segment.departureDate.date.isBefore(segments[index - 1].departureDate.date)}
				/>
			);
		});
	}

	render(): React.ReactNode {
		const { segments, isCR, continueRoute } = this.props;

		return (
			<div className={classnames('widget-segments', { 'widget-segments_CR': isCR })}>
				{isCR ? this.renderAllSegment() : this.renderFirstSegment()}

				{isCR && segments.length < MAX_SEGMENTS_COUNT && (
					<div className="widget__addSegment" onClick={continueRoute}>
						{i18n('continue_route')}
					</div>
				)}
			</div>
		);
	}
}

const mapStateToProps = (state: ApplicationState): StateProps => {
	return {
		segments: state.form.segments,
		isCR: isCR(state),
		isRT: isRT(state),
		arrivalSuggestAirport: getArrivalSuggestAirport(state)
	};
};

const mapActionsToProps = {
	continueRoute,
	deleteSegment,
	selectAirport
};

export default connect(mapStateToProps, mapActionsToProps)(SegmentsContainer);
