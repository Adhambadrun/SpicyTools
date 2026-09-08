import * as React from 'react';
import * as classnames from 'classnames';
import { connect } from 'react-redux';

import { ApplicationState, CommonThunkAction } from '../../state';
import { HotDeal, getDiscount, getHeatLevel, getPeppers, sortByHeat } from '../../deals';
import { applyDeal } from '../../store/form/deals/actions';
import { i18n } from '../../i18n';

interface StateProps {
	deals: HotDeal[];
}

interface DispatchProps {
	applyDeal: (deal: HotDeal) => CommonThunkAction;
}

type Props = StateProps & DispatchProps;

/**
 * The spice rack: a rail of hot fares above the search form.
 *
 * Deals are supplied through the `hotDeals` config option. Each one is a real,
 * priced fare from the site owner — SpicyTools only works out how hot it is.
 */
class Deals extends React.Component<Props> {
	dealClickHandler(deal: HotDeal): void {
		this.props.applyDeal(deal);
	}

	renderPeppers(deal: HotDeal): React.ReactNode {
		const peppers: React.ReactNode[] = [];

		for (let index = 0; index < getPeppers(deal); index++) {
			peppers.push(<span className="widget-deals__pepper" key={index}>&#127798;</span>);
		}

		return <span className="widget-deals__heat" title={i18n(`heat_${getHeatLevel(deal)}`)}>{peppers}</span>;
	}

	render(): React.ReactNode {
		const deals = sortByHeat(this.props.deals);

		if (!deals.length) {
			return null;
		}

		return (
			<div className="widget-deals">
				<div className="widget-deals__header">
					<span className="widget-deals__title">{i18n('deals_title')}</span>
					<span className="widget-deals__hint">{i18n('deals_hint')}</span>
				</div>

				<ul className="widget-deals__list">
					{deals.map((deal, index) => {
						const discount = getDiscount(deal);
						const heat = getHeatLevel(deal);

						return (
							<li key={`${deal.departure}-${deal.arrival}-${index}`}>
								<button
									className={classnames('widget-deals__deal', `widget-deals__deal_${heat}`)}
									onClick={() => this.dealClickHandler(deal)}
								>
									<span className="widget-deals__route">{deal.departure} &#8594; {deal.arrival}</span>

									{deal.label && <span className="widget-deals__label">{deal.label}</span>}

									<span className="widget-deals__price">
										{i18n('deals_from')}&nbsp;{deal.currency ? `${deal.currency} ` : ''}{deal.price}
									</span>

									<span className="widget-deals__meta">
										{this.renderPeppers(deal)}

										{discount > 0 && (
											<span className="widget-deals__discount">-{discount}%</span>
										)}

										{deal.directFlight && (
											<span className="widget-deals__direct">{i18n('deals_direct')}</span>
										)}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			</div>
		);
	}
}

const mapStateToProps = (state: ApplicationState): StateProps => ({
	deals: state.system.hotDeals || []
});

const mapActionsToProps: DispatchProps = {
	applyDeal
};

export default connect(mapStateToProps, mapActionsToProps)(Deals);
