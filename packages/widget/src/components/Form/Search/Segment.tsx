import * as React from 'react';
import { cityFrom, cityTo } from 'lvovich';

import AutocompleteContainer from './AutocompleteContainer';
import DatesContainer from './DatesContainer';
import { AutocompleteFieldType, DatepickerState, ArrivalSuggestAirport, SegmentState } from '../../../state';
import { SegmentAction } from '../../../store/form/segments/actions';
import { selectAirport } from '../../../store/form/segments/autocomplete/actions';
import { i18n } from '../../../i18n';

interface Props {
	segment: SegmentState;
	segmentId: number;
	removeSegment?: () => SegmentAction;
	canBeRemoved: boolean;
	showDatesError: boolean;
	returnDate?: DatepickerState;
	arrivalSuggestAirport?: ArrivalSuggestAirport;
	selectAirport?: typeof selectAirport;
}

export default class Segment extends React.Component<Props> {
	constructor(props: Props) {
		super(props);

		this.deleteSegment = this.deleteSegment.bind(this);
	}

	shouldComponentUpdate(nextProps: Props): boolean {
		const { canBeRemoved, showDatesError, segment } = this.props;

		return (
			canBeRemoved !== nextProps.canBeRemoved ||
			showDatesError !== nextProps.showDatesError ||
			segment !== nextProps.segment
		);
	}

	deleteSegment(): void {
		this.props.removeSegment();
	}

	render(): React.ReactNode {
		const { segment, segmentId, returnDate, canBeRemoved, showDatesError, arrivalSuggestAirport, selectAirport } = this.props;

		return <div className="widget-segments__segment">
			<AutocompleteContainer
				departureAutocomplete={segment.autocomplete.departure}
				arrivalAutocomplete={segment.autocomplete.arrival}
				segmentId={segmentId}
			/>

			{arrivalSuggestAirport && <div className="widget-segments__arrivalSuggestion">
				{
					i18n('arrivalSuggestionAirport')
						.replace('[%-suggest-%]', arrivalSuggestAirport.airport.city.name)
						.replace('[%-selected-%]', cityFrom(segment.autocomplete.arrival.airport.city.name))
						.replace('[%-distance-%]', arrivalSuggestAirport.distance.toString())
				}

				<span onClick={() => selectAirport(arrivalSuggestAirport.airport, AutocompleteFieldType.Arrival)}>
					{cityTo(arrivalSuggestAirport.airport.city.name)}.
				</span>
			</div>}

			<DatesContainer
				segmentId={segmentId}
				departureDatepicker={segment.departureDate}
				returnDatepicker={returnDate}
				datesIsNotOrder={showDatesError}
			/>

			{canBeRemoved && <div className="widget-segments__segment__drop" onClick={this.deleteSegment}/>}
		</div>;
	}
}
