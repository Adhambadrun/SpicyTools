import * as React from 'react';
import * as classnames from 'classnames';
import { AutocompleteOption } from '../../../../services/models/AutocompleteOption';

interface Props {
	option: AutocompleteOption;
}

export default ({ option }: Props) => {
	return <div className={classnames('widget-airports__suggestion', { 'widget-airports__suggestion_insideAggregation': option.value.isInsideAggregation }, { 'widget-airports__suggestion_isAggregation': option.value.isAggregationRoot })}>
		<span className={classnames('widget-airports__suggestion__title', { 'widget-airports__suggestion__title_bold': option.value.isDirect })}>
			{option.value.airport.name}
		</span>

		{option.value.airport.country ?
			<span className="widget-airports__suggestion__countryName">{option.value.airport.country.name}</span> : null}

		<span className="widget-airports__suggestion__code">
			{option.value.airport.IATA}
		</span>
	</div>;
};
