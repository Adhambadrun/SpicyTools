import { createSelector } from 'reselect';
import { getTotalPassengersCount } from './passengers/selectors';
import { getAltLayout } from '../../utils';
import {
	ApplicationMode,
	ApplicationState,
	AutocompleteDefaultGroupsState,
	AutocompleteFieldState,
	FormState,
	Language, ArrivalSuggestAirport,
	RouteType,
	SearchInfo,
	SearchInfoPassenger,
	SearchInfoSegment,
	SegmentState,
	SystemState
} from '../../state';
import { AutocompleteSuggestion } from '../../services/models/AutocompleteSuggestion';
import { AutocompleteOption } from '../../services/models/AutocompleteOption';
import { i18n } from '../../i18n';
import { eventTap, SearchFormEvent } from '../../services/eventLogger';

export const getConfig = (state: ApplicationState): SystemState => state.system;

export const isVerticalForm = (state: ApplicationState): boolean => state.system.verticalForm;

export const getLocaleForApi = createSelector(getConfig, (config): Language => {
	// Ukrainian language can't be recognized by its real ISO code `uk` in the fare API.
	// Use `ua` instead.
	return config.locale === Language.Ukrainian ? 'ua' as Language : config.locale;
});

export const isWebsky = createSelector(
	[ getConfig ],
	(config: SystemState): boolean => config.mode === ApplicationMode.WEBSKY
);

export const showCouponField = createSelector(
	[ getConfig, isWebsky ],
	(config: SystemState, isWebskyMode: boolean): boolean => isWebskyMode && config.enableCoupon
);

export const showMileCardField = createSelector(
	[ getConfig, isWebsky ],
	(config: SystemState, isWebskyMode: boolean): boolean => isWebskyMode && config.enableMileCard // Disabled for now (feature is not implemented in Websky yet)
);

export const getForm = (state: ApplicationState): FormState => state.form;

export const isCR = createSelector(
	[ getForm ],
	(config: FormState): boolean => config.routeType === RouteType.CR
);

export const isRT = createSelector(
	[ getForm ],
	(config: FormState): boolean => config.routeType === RouteType.RT && config.segments.length > 1
);

const parseSegmentStateToSearchInfo = (segment: SegmentState): SearchInfoSegment => {
	return {
		departure: segment.autocomplete.departure.airport,
		arrival: segment.autocomplete.arrival.airport,
		departureDate: segment.departureDate.date.hour(0).minute(0).second(0).millisecond(0)
	};
};

export const getSearchInfo = createSelector(
	[ getForm ],
	(form: FormState): SearchInfo => {
		let segments: SearchInfoSegment[] = [];

		segments.push(parseSegmentStateToSearchInfo(form.segments[0]));

		if (form.routeType === RouteType.RT) {
			segments.push({
				departure: form.segments[0].autocomplete.arrival.airport,
				arrival: form.segments[0].autocomplete.departure.airport,
				departureDate: form.segments[1].departureDate.date.hour(0).minute(0).second(0).millisecond(0)
			});
		}
		else if (form.routeType === RouteType.CR) {
			segments = form.segments.map((segment: SegmentState): SearchInfoSegment => {
				return parseSegmentStateToSearchInfo(segment);
			});
		}

		const passengers: SearchInfoPassenger[] = [];

		for (const passType in form.passengers) {
			if (form.passengers.hasOwnProperty(passType)) {
				passengers.push({
					type: form.passengers[passType].code,
					count: form.passengers[passType].count
				});
			}
		}

		return {
			segments,
			passengers,
			directOnly: form.additional.directFlight,
			routeType: form.routeType,
			serviceClass: form.additional.classType
		};
	}
);

const segmentIsValid = (segment: SegmentState): boolean => {
	let isValid = true;

	if (!segment.departureDate.date) {
		isValid = false;
	}
	else if (!segment.autocomplete.departure.airport) {
		isValid = false;
	}
	else if (!segment.autocomplete.arrival.airport) {
		isValid = false;
	}
	else if (segment.autocomplete.departure.airport.IATA === segment.autocomplete.arrival.airport.IATA) {
		isValid = false;
	}

	return isValid;
};

/**
 * Check if search form data is valid and ready for further operations.
 *
 * Checking for:
 * - valid departure and arrival airports
 * - valid departure date
 * - valid number of selected passengers
 */
export const formIsValid = createSelector(
	[ getForm, getTotalPassengersCount, isCR, isRT ],
	(form: FormState, totalPassengersCount: number, isCR: boolean, isRT: boolean): boolean => {
		let isValid = true,
			errorCode = null;
		const segments = form.segments;

		if (!segments.length) {
			isValid = false;

			errorCode = 'not_segments';
		}
		else if (totalPassengersCount <= 0) {
			isValid = false;

			errorCode = 'not_passengers';
		}
		else if (form.coupon.number && !form.coupon.number.match(/^[\d]+$/g)) {
			isValid = false;

			errorCode = 'coupon_not_valid';
		}
		else if (
			form.mileCard.number && !form.mileCard.number.match(/^[\d]+$/g) ||
			form.mileCard.number && !form.mileCard.password ||
			form.mileCard.password && (!form.mileCard.number || !form.mileCard.number.match(/^[\d]+$/g))
		) {
			isValid = false;

			errorCode = 'mile_cart_not_valid';
		}

		if (isValid) {
			if (isCR) {
				segments.forEach((segment, index) => {
					if(segmentIsValid(segment)) {
						if (index > 0 && segment.departureDate.date.isBefore(segments[index - 1].departureDate.date)) {
							isValid = false;

							errorCode = 'departure_dates_not_in_order_in_complex_route';
						}
					}
					else {
						isValid = false;

						errorCode = 'segment_not_valid_in_complex_route';
					}
				});
			}
			else {
				if (!segmentIsValid(segments[0])) {
					isValid = false;

					errorCode = 'segment_not_valid';
				}
				if (isRT) {
					if (segments[1].departureDate.date && segments[1].departureDate.date.isBefore(segments[0].departureDate.date)) {
						isValid = false;

						errorCode = 'dates_not_in_order_in_round_trip';
					}
				}
			}
		}

		if (!isValid) {
			eventTap(SearchFormEvent.NotValid, errorCode);
		}

		return isValid;
	}
);

const getSuggestionsFromAutocomplete = (state: AutocompleteFieldState): AutocompleteSuggestion[] => state.suggestions;
const getDefaultOptionsFromState = (state: ApplicationState): AutocompleteDefaultGroupsState => state.form.segments[0].autocomplete.defaultGroups;

export const suggestionsToOptionsArray = (options: AutocompleteSuggestion[]): AutocompleteOption[] => {
	return options
		.filter(option => option && option.airport && option.airport.name && option.airport.nameEn && option.airport.IATA)
		.map((option): AutocompleteOption => {
			return {
				value: option,
				label: option.airport.name + option.airport.nameEn + option.airport.IATA + getAltLayout(option.airport.name)
			};
		});
};

export interface DefaultOptionGroup {
	label: string;
	options: any[];
	className: string;
}

const mapGroupOptions = (groups: AutocompleteDefaultGroupsState, segments: SegmentState[]): DefaultOptionGroup[][] => {
	const groupsArray: DefaultOptionGroup[][] = [];

	segments.forEach((segment, index) => {
		groupsArray.push([]);

		for (const group in groups) {
			if (groups.hasOwnProperty(group)) {
				const
					optionsArray = [],
					options = groups[group].options;

				for (const option in options) {
					if (options.hasOwnProperty(option)) {
						if (
							(segment.autocomplete.departure.airport && segment.autocomplete.departure.airport.IATA === options[option].IATA) ||
							(segment.autocomplete.arrival.airport && segment.autocomplete.arrival.airport.IATA === options[option].IATA)
						) {
							continue;
						}

						optionsArray.push({ label: options[option].name, value: { airport: options[option] } });
					}
				}

				if (optionsArray.length) {
					groupsArray[index].push({
						label: i18n(groups[group].name),
						options: optionsArray,
						className: groups[group].className
					});
				}
			}
		}
	});

	return groupsArray;
};

export const getSegments = (form: ApplicationState) => form.form.segments;

/**
 * Create autocomplete options list for arrival and departure.
 */
export const getSuggestionOptions = createSelector(getSuggestionsFromAutocomplete, suggestionsToOptionsArray);
export const getDefaultOptionsGroup = createSelector([getDefaultOptionsFromState, getSegments], mapGroupOptions);
export const getArrivalSuggestAirport = createSelector([isCR, getSegments], (isCR: boolean, segments: SegmentState[]): ArrivalSuggestAirport => {
	if (!isCR) {
		if (
			segments[0].autocomplete.nearSuggestedAirports &&
			segments[0].autocomplete.arrival.airport.IATA &&
			segments[0].autocomplete.departure.airport.IATA
		) {
			const route = `${segments[0].autocomplete.departure.airport.IATA}-${segments[0].autocomplete.arrival.airport.IATA}`;

			if (segments[0].autocomplete.nearSuggestedAirports.hasOwnProperty(route)) {
				const suggestedAirport = segments[0].autocomplete.nearSuggestedAirports[route];

				return {
					airport: suggestedAirport.airport,
					distance: suggestedAirport.distance
				};
			}
		}
	}

	return null;
});
