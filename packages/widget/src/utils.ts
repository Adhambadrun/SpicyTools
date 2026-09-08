import * as moment from 'moment';
import { Moment } from 'moment';
import 'whatwg-fetch';

export const clearURL = (url: string): string => url.trim().replace(/^\/|\/$/g, '');
export const REQUEST_TIMEOUT = 10000;
export const OK_STATUS = 200;

interface AnyObject {
	[paramName: string]: any
}

export const encodeURLParams = (params: AnyObject = {}): string => {
	const numOfParams = Object.keys(params).length;
	let result = '',
		i = 0;

	if (numOfParams) {
		for (const paramName in params) {
			if (params.hasOwnProperty(paramName) && params[paramName]) {
				if (i > 0) {
					result += '&';
				}

				result += `${paramName}=${params[paramName]}`;

				i++;
			}
		}
	}

	return result;
};

/**
 * Create URL string with params.
 *
 * @param {String} root
 * @param {Object} params
 * @returns {String}
 */
export const URL = (root: string, params: AnyObject = {}): string => {
	let result = clearURL(root);
	const encodedParams = encodeURLParams(params);

	if (encodedParams) {
		result += '?' + encodedParams;
	}

	return result;
};

/**
 * Get an array of MomentJS dates between two given dates.
 *
 * @param firstDate
 * @param secondDate
 * @param withBoundaryDates
 * @returns {Array}
 */
export const getIntermediateDates = (firstDate: Moment, secondDate: Moment = moment(), withBoundaryDates: boolean = false): Moment[] => {
	const result: Moment[] = [];

	if (firstDate && secondDate) {
		const startDate = firstDate.clone();
		const endDate = secondDate.clone();

		while (startDate.add(1, 'days').diff(endDate) < 0) {
			result.push(startDate.clone());
		}

		if (withBoundaryDates) {
			result.unshift(firstDate);
			result.push(secondDate);
		}
	}

	return result;
};

export const isIE = (): boolean => {
	return navigator.appName === 'Microsoft Internet Explorer' ||
		!!(navigator.userAgent.match(/Trident/) ||
			navigator.userAgent.match(/rv:11/));
};

const getAltLayoutCache: AnyObject = {};

export const getAltLayout = (string: string): string => {
	if (getAltLayoutCache[string]) {
		return getAltLayoutCache[string];
	}

	const eng = ' `qwertyuiop[]asdfghjkl;\'zxcvbnm,./~QWERTYUIOP{}ASDFGHJKLZXCVBNM<>?'.split('');
	const rus = ' ёйцукенгшщзхъфывапролджэячсмитьбю.ЁЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЯЧСМИТЬБЮ,'.split('');
	const map: AnyObject = {};
	let result = '';

	if (/[a-zA-Z]+/.test(string)) {
		eng.map((engChar, index) => {
			map[engChar] = rus[index];
		});
	} else {
		rus.map((rusChar, index) => {
			map[rusChar] = eng[index];
		});
	}

	for (let i = 0, max = string.length; i < max; i++) {
		result += map[string[i]];
	}

	if (result) {
		getAltLayoutCache[string] = result;
	}

	return result;
};

interface FetchWithFallbackParams {
	url: string,
	fallbackURL?: string,
	options?: RequestInit
}

export const fetchWithFallback = ({ url, fallbackURL, options }: FetchWithFallbackParams): Promise<Response> => {
	const timeout = new Promise((resolve, reject) => {
		return setTimeout(
			() => reject(new Error('fetchWithFallback timed out')),
			REQUEST_TIMEOUT
		);
	});

	const req = fetch(url, options);

	return Promise.race([req, timeout])
		.then(async (res: Response) => {
			if (res && res.status !== OK_STATUS) {
				throw new Error('request fails');
			}

			try {
				// if we want to check that response is valid json, we need to clone response
				// otherwise we can get TypeError: Failed to execute 'json' on 'Response': body stream is locked
				// or already read error https://github.com/whatwg/fetch/issues/196
				const clone: Response = await res.clone();
				await clone.json();

				return req;
			} catch (e) {
				if (fallbackURL) {
					return fetchWithFallback({ url: fallbackURL, options });
				} else {
					return req;
				}
			}
		})
		.catch(() => {
			if (fallbackURL) {
				return fetchWithFallback({ url: fallbackURL, options });
			} else {
				return req;
			}
		});
};
