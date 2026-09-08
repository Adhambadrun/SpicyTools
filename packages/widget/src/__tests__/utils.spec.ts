import { getAltLayout, encodeURLParams, fetchWithFallback } from '../utils';

const JEST_TIMEOUT = 15000;
jest.setTimeout(JEST_TIMEOUT);

/* global describe */
/* global it */
/* global expect */
describe('utils', () => {
	describe('getAltLayout', () => {
		it('should return `vjcrdf` when `москва` passed', () => {
			expect(getAltLayout('москва')).toBe('vjcrdf');
		});

		it('should return `москва` when `vjcrdf` passed', () => {
			expect(getAltLayout('vjcrdf')).toBe('москва');
		});
	});

	describe('encodeURLParams', () => {
		it('should return `a=1` when `{ a: 1 }` passed', () => {
			expect(encodeURLParams({ a: 1 })).toBe('a=1');
		});

		it('should return `a=1&b=2` when `{ a: 1, b: 2 }` passed', () => {
			expect(encodeURLParams({ a: 1, b: 2 })).toBe('a=1&b=2');
		});

		it('should return `` when `{}` or anything but object passed', () => {
			expect(encodeURLParams({})).toBe('');
			expect(encodeURLParams()).toBe('');
		});
	});

	describe('fetchWithFallback', () => {
		beforeEach(() => {
			// reset calls count
			fetch.resetMocks();

			// return another response according to url
			// https://github.com/jefflau/jest-fetch-mock/issues/52#issuecomment-386616821
			fetch.mockImplementation(url => {
				switch (url) {
					case 'timeout.com':
						return new Promise(resolve => {
							setTimeout(() => {
								resolve(JSON.stringify('timeout'));
							}, JEST_TIMEOUT);
						});
					case 'ok.com':
						return Promise.resolve(
							new Response(JSON.stringify('ok'))
						);
					case 'not-ok.com':
						return Promise.reject(
							new Response(JSON.stringify('not-ok'), { status: 500, statusText: 'NOT OK' })
						);
					case 'unserializable-response.com':
						return Promise.resolve(JSON.stringify('['));
					default:
						return Promise.resolve(
							new Response(JSON.stringify('ok'))
						);
				}
			});
		});

		it('should return ok if first url returns error', async () => {
			const REQ_COUNT = 2;
			const resp = await fetchWithFallback({
				url: 'not-ok.com',
				fallbackURL: 'ok.com'
			});

			const data = await resp.json();

			expect(fetch.mock.calls.length).toBe(REQ_COUNT);
			expect(data).toBe('ok');
		});

		it('should make second request when first returns unserializable string', async () => {
			const REQ_COUNT = 2;
			const resp = await fetchWithFallback({
				url: 'unserializable-response.com',
				fallbackURL: 'ok.com'
			});

			const data = await resp.json();

			expect(fetch.mock.calls.length).toBe(REQ_COUNT);
			expect(data).toBe('ok');
		});

		it('should return response from second url because timeout', async () => {
			const resp = await fetchWithFallback({
				url: 'timeout.com',
				fallbackURL: 'ok.com'
			});
			const data = await resp.json();
			expect(data).toEqual('ok');
		});
	});
});
