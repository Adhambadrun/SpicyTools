import moment = require('moment');
import { spicyFastSearch, spicyFastSearchPassengers, spicyFastSearchSegment } from '../actions';
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

	describe('runSpicySearch', () => {
		it('should build Fast Search for the default results page', () => {
			const store = getStore(customState),
				state = store.getState();

			state.form.segments = [segment as any];

			expect(spicyFastSearch(state)).toEqual('http://api.spicyquote.test/results/cMOWaSVO20181201ADT1-class=Economy');
		});

		it('should build Fast Search for AWP results page', () => {
			const store = getStore(customState),
				state = store.getState();

			state.form.segments = [segment as any];

			expect(spicyFastSearch(state, true)).toEqual('http://api.spicyquote.test/#/results/MOWSVO20181201ADT1-class=Economy');
		});
	});
});
