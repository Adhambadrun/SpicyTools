import * as React from 'react';
import * as classnames from 'classnames';

export default ({ value: option, placeholder, readOnly = false }: any) => {
	const airport = option.value;

	return <span className={classnames('widget-airports__select__value', { 'widget-airports__select__value_readOnly': readOnly })}>
		<div className="widget-airports__select__value__placeholder">{placeholder}</div>

		<span className="widget-airports__select__value__airportName">
			{airport.name}
		</span>

		{airport.country && (
			<span className="widget-airports__select__value__countryName">
				<span className="widget-airports__select__value__comma">, </span>
				{airport.country.name}
			</span>
		)}
	</span>;
};
