import * as Cache from './cache';
import { ExtendedI18nPool, I18nPool, Language } from './state';

let poolCache: I18nPool = {};

export const init = (extender: ExtendedI18nPool): void => {
	if (typeof extender === 'object' && Object.keys(extender).length) {
		const newPool = extender[Cache.getLocale()];

		if (typeof newPool === 'object' && Object.keys(newPool).length) {
			poolCache = {
				...poolCache,
				...newPool
			};
		}
	}
};

/**
 * Internationalization module.
 *
 * @param key
 * @returns {String}
 */
export const i18n = (key: string): string => {
	if (poolCache[key]) {
		return poolCache[key];
	}

	try {
		const locale = Cache.getLocale();
		const pool = require(`i18n/${locale}`);
		let result = key;

		if (pool[key]) {
			result = pool[key];
			poolCache[key] = result;
		}
		// Labels added after a translation was written fall back to English
		// instead of leaking the raw key into the UI.
		else if (locale !== Language.English) {
			const englishPool = require(`i18n/${Language.English}`);

			if (englishPool[key]) {
				result = englishPool[key];
				poolCache[key] = result;
			}
		}

		return result;

	}
	catch (e) {
		console.warn(e);

		return key;
	}
};
