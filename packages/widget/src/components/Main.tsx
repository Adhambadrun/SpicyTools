import * as React from 'react';
import * as classnames from 'classnames';
import { connect } from 'react-redux';

import { ApplicationState, CommonThunkAction, OnSearchFunction } from '../state';
import WebskyHiddenForm from './WebskyHiddenForm';
import {
	isCR, isVerticalForm,
	isWebsky,
	showCouponField,
	showMileCardField
} from '../store/form/selectors';
import { startSearch } from '../store/form/actions';
import SegmentsContainer from './Form/Search/SegmentsContainer';
import PassengersContainer, { RenderPassengerSelector } from './Form/Search/PassengersContainer';
import CouponContainer from './Form/Search/Bonus/CouponContainer';
import MileCardContainer from './Form/Search/Bonus/MileCardContainer';
import AdditionalOptionsContainer from './Form/Search/AdditionalOptionsContainer';
import DealsContainer from './Form/DealsContainer';
import { i18n } from '../i18n';

interface OwnProps {
	onSearch?: OnSearchFunction;
	renderPassengerSelector?: RenderPassengerSelector;
}

interface StateProps {
	showDeals: boolean;
	verticalForm: boolean;
	isWebskyMode: boolean;
	showCouponField: boolean;
	showMileCardField: boolean;
	isComplexRouteMode: boolean;
}

interface DispatchProps {
	startSearch: (onSearch?: OnSearchFunction) => CommonThunkAction;
}

type Props = OwnProps & StateProps & DispatchProps;

class Main extends React.Component<Props> {
	constructor(props: Props) {
		super(props);

		this.startSearchHandler = this.startSearchHandler.bind(this);
	}

	startSearchHandler(): void {
		this.props.startSearch(this.props.onSearch);
	}

	render(): React.ReactNode {
		const { showDeals, verticalForm, isWebskyMode, showCouponField, showMileCardField, isComplexRouteMode, renderPassengerSelector } = this.props;

		return (
			<section className={classnames('widget', { widget_vertical: verticalForm }, { widget_CR: isComplexRouteMode })}>
				<div className="widget__holder">
					{showDeals && <DealsContainer/>}

					<SegmentsContainer/>

					<div className="widget-footer">
						<div className="widget-footer__col">
							<PassengersContainer renderSelector={renderPassengerSelector}/>
						</div>

						{showCouponField && <div className="widget-footer__col"><CouponContainer /></div>}
						{showMileCardField && <div className="widget-footer__col"><MileCardContainer /></div>}

						<div className="widget-footer__col">
							<AdditionalOptionsContainer/>

							<button className="btn btn-primary widget__startButton" onClick={this.startSearchHandler}>
								{i18n('search')}

								<span className="widget__tickets">
									{(i18n('search_tickets'))}
								</span>
							</button>
						</div>
					</div>
				</div>

				{isWebskyMode && <WebskyHiddenForm/>}
			</section>
		);
	}
}

const mapStateToProps = (state: ApplicationState, ownProps: OwnProps): OwnProps & StateProps => {
	return {
		...ownProps,
		showDeals: !state.system.hideDeals && Boolean(state.system.hotDeals && state.system.hotDeals.length),
		verticalForm: isVerticalForm(state),
		isWebskyMode: isWebsky(state),
		showCouponField: showCouponField(state),
		showMileCardField: showMileCardField(state),
		isComplexRouteMode: isCR(state)
	};
};

const mapActionsToProps = {
	startSearch
};

export default connect(mapStateToProps, mapActionsToProps)(Main);
