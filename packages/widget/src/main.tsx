import './ponyfills';
import * as moment from 'moment';
import * as React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import 'whatwg-fetch';

import * as i18n from './i18n';
import Main from './components/Main';
import { cacheState, getStore } from './store';
import './css/main.scss';
import { ApplicationState, HotDeal, Language, OnSearchFunction, SystemState } from './state';
import { enableCaching } from './store/system/actions';
import { applyDeal as applyDealAction } from './store/form/deals/actions';

let storeGlobal: Store<ApplicationState>;

/**
 * This is exported to the global scope as `SpicyQuote.init`.
 *
 * @param {SystemState} config
 */
export const init = (config: SystemState) => {
	if (!config.rootElement) {
		throw Error('Please specify `rootElement` parameter in the configuration object.');
	}

	if (!config.spicyURL) {
		throw Error('Please specify `spicyURL` parameter in the configuration object.');
	}

	// Fix ukrainian language code.
	if ((config.locale as string).toLocaleLowerCase() === 'ua') {
		config.locale = Language.Ukrainian;
	}

	if (config.locale !== Language.Russian) {
		// Pull current value of the DOY.
		const doy = moment.localeData(Language.English).firstDayOfYear();

		// Set monday as a first day of the week and restore the DOY value.
		moment.updateLocale(config.locale, {
			week: {
				dow: 1,
				doy: doy
			}
		});
	}

	const store = getStore(config);

	i18n.init(config.customTranslations);

	storeGlobal = store;

	render(
		<Provider store={store}>
			<Main onSearch={config.onSearch}/>
		</Provider>,
		config.rootElement
	);

	// Subscribe to new state updates and cache new state.
	store.subscribe(() => cacheState(store.getState()));
};

/**
 * Load a hot deal into the form and run the search.
 *
 * Lets a host page drive the widget from its own UI (a deals board, a campaign
 * banner, anything) instead of duplicating form-filling logic:
 *
 * ```js
 * SpicyQuote.applyDeal({ departure: 'CAI', arrival: 'IST', price: 118 });
 * ```
 *
 * @param {HotDeal} deal
 */
export const applyDeal = (deal: HotDeal): void => {
	if (!storeGlobal) {
		throw Error('Call `SpicyQuote.init()` before `SpicyQuote.applyDeal()`.');
	}

	storeGlobal.dispatch(applyDealAction(deal));
};

/**
 * Enable saving widget data in Local Storage if `disableCaching` disabled it
 */
export const enableCache = (): void => {
	storeGlobal.dispatch(enableCaching());
};

export { default as Component } from './components/Component';
