import * as React from 'react';
import Tooltip from '../../../../UI/Tooltip';
import { i18n } from '../../../../../i18n';
import { FormEventHandler, MouseEventHandler } from 'react';

interface Props {
	number?: string;
	showTooltip?: boolean;
	onClose: MouseEventHandler<HTMLDivElement>;
	changeMileCardNumber: FormEventHandler<HTMLInputElement>;
}

class Input extends React.Component<Props> {
	shouldComponentUpdate(nextProps: Props): boolean {
		return this.props.number !== nextProps.number || this.props.showTooltip !== nextProps.showTooltip;
	}

	render(): React.ReactNode {
		const
			{ number, showTooltip, onClose, changeMileCardNumber } = this.props,
			visibleNumber = number ? number : '';

		return <div className="widget-mileCard__wrapper__block">
			<Tooltip message={i18n('mileCardNumberError')} isActive={showTooltip}>
				<input
					className="form-control"
					ref={(input: HTMLInputElement) => input && input.focus()}
					value={visibleNumber}
					onChange={changeMileCardNumber}
					placeholder={i18n('mileCardNumberPlaceholder')}
					spellCheck={false}
				/>
			</Tooltip>

			<div className="widget-ui-input__closer" onClick={onClose}/>
		</div>;
	}
}

export default Input;
