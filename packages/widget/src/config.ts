import { SystemState } from './state';

/**
 * Configuration gate shared by `SpicyTools.init()` (main.tsx) and the
 * `Component` class, so an embed can be validated without a DOM to render into.
 *
 * `apiBase` is the documented option and `spicyURL` its deprecated alias;
 * `store.getStore()` maps the latter from the former, so either one satisfies
 * the widget. Validating only `spicyURL` here used to reject the documented
 * `SpicyTools.init({ rootElement, apiBase })` call before the mapping ran.
 */
export const validateConfig = (config: SystemState): void => {
	if (!config.rootElement) {
		throw Error('Please specify `rootElement` parameter in the configuration object.');
	}

	if (!config.apiBase && !config.spicyURL) {
		throw Error('Please specify `apiBase` (or the deprecated `spicyURL`) parameter in the configuration object.');
	}
};
