import * as React from 'react';
import { Store } from 'redux';
import { Provider } from 'react-redux';

import Main from './Main';
import * as i18n from '../i18n';
import { ApplicationState, SystemState, OnSearchFunction, SearchInfo, RouteType } from '../state';
import { cacheState, getStore } from '../store';
import { getSearchInfo } from '../store/form/selectors';
import { setSearchInfoAction } from '../store/form/actions';
import { RenderPassengerSelector } from './Form/Search/PassengersContainer';
import { setRouteType } from '../store/form/route/actions';
import { validateConfig } from '../config';

export interface Props extends SystemState {
	onSearch?: OnSearchFunction;
	renderPassengerSelector?: RenderPassengerSelector;
}

class Component extends React.Component<Props> {
	protected store: Store<ApplicationState>;

	constructor(props: Props) {
		super(props);

		// Same gate as `init()` in main.tsx: `apiBase` (documented) or
		// `spicyURL` (deprecated alias) — either one is enough.
		validateConfig(props);

		this.store = getStore(props);

		i18n.init(props.customTranslations);

		this.store.subscribe(() => cacheState(this.store.getState()));
	}

	setRouteType(routeType: RouteType): void {
		this.store.dispatch(setRouteType(routeType));
	}

	getSeachInfo(): SearchInfo {
		return getSearchInfo(this.store.getState());
	}

	setSearchInfo(searchInfo: SearchInfo): void {
		this.store.dispatch(setSearchInfoAction(searchInfo));
	}

	render(): React.ReactNode {
		return (
			<Provider store={this.store}>
				<Main onSearch={this.props.onSearch} renderPassengerSelector={this.props.renderPassengerSelector}/>
			</Provider>
		);
	}
}

export default Component;
