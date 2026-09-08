import 'custom-event-polyfill';

export enum SearchFormEvent {
	StartSearch = 'search',
	TripType = 'tripType.value',
	DirectFlight = 'directFlights.active',
	ServiceClass = 'serviceClass.value',
	VicinityDates = 'vicinityDates.active',
	NotValid = 'search.validationError',
	DealApplied = 'deal.applied'
}

const eventPrefix = 'analytics.spicytools.';

export const eventTap = (event: string, value: any = null) => {
	document.dispatchEvent(new CustomEvent(eventPrefix + event, {
		detail: value
	}));
};
