import moment = require('moment');
import { spicyFastSearch, spicyFastSearchPassengers, spicyFastSearchSegment, spicyToolSearchURL } from '../actions';
import { getStore } from '../../../store';

const segment = {
	autocomplete: {
		departure: {
			airport: {
				IATA: 'MOW',
				isCity: true
			}
		},
		arrival: {
			airport: {
				IATA: 'SVO',
				isCity: false
			}
		}
	},
	departureDate: {
		isActive: true,
		date: moment('2018-12-01')
	}
};

const customState = {
	spicyURL: 'http://api.spicyquote.test'
};

describe('runSpicySearch', () => {
	it('should correct build Fast Search passengers info', () => {
		const passengers = {
			ADT: {
				code: 'ADT',
				count: 3
			},
			CLD: {
				code: 'CLD',
				count: 2
			}
		};

		expect(spicyFastSearchPassengers(passengers as any)).toEqual('ADT3CLD2');
	});

	describe('spicyFastSearchSegment', () => {
		it('should build FS segment for the default results page', () => {
			expect(spicyFastSearchSegment(segment as any)).toEqual('cMOWaSVO20181201');
		});

		it('should build FS segment for AWP results page', () => {
			expect(spicyFastSearchSegment(segment as any, true)).toEqual('MOWSVO20181201');
		});
	});

	describe('SpicyTool search interface', () => {
		it('should build a SpicyTool /api/v2/search URL for a one-way trip', () => {
			const store = getStore(customState),
				state = store.getState();

			state.form.segments = [segment as any];

			expect(spicyFastSearch(state)).toEqual(
				'http://api.spicyquote.test/api/v2/search?origin=MOW&destination=SVO&date=2018-12-01&cabin=economy&passengers=1'
			);
		});

		it('should carry the return date for a round trip', () => {
			const store = getStore(customState),
				state = store.getState();

			state.form.segments = [segment as any, { ...segment, departureDate: { isActive: true, date: moment('2018-12-09') } } as any];
			state.form.routeType = 'RT';

			// `return_flex=0` is the API default, so it is not sent.
			expect(spicyToolSearchURL(state)).toEqual(
				'http://api.spicyquote.test/api/v2/search?origin=MOW&destination=SVO&date=2018-12-01&cabin=economy&passengers=1&return_date=2018-12-09'
			);
		});

		it('should carry flexible dates and the direct-only filter', () => {
			const store = getStore(customState),
				state = store.getState();

			state.form.segments = [segment as any, { ...segment, departureDate: { isActive: true, date: moment('2018-12-09') } } as any];
			state.form.routeType = 'RT';
			state.form.additional.vicinityDates = true;
			state.form.additional.directFlight = true;

			expect(spicyToolSearchURL(state)).toEqual(
				'http://api.spicyquote.test/api/v2/search?origin=MOW&destination=SVO&date=2018-12-01&cabin=economy&passengers=1&max_stops=0&return_date=2018-12-09&return_flex=3'
			);
		});
	});
});
