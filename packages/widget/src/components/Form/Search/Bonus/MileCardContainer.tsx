import * as React from 'react';
import onClickOutside, { InjectedOnClickOutProps } from 'react-onclickoutside';
import { connect } from 'react-redux';
import { AnyAction, bindActionCreators, Dispatch } from 'redux';
import { changeMileCardNumber, changeMileCardPassword, MileCardAction } from '../../../../store/form/mileCard/actions';
import { getMileCardNumber, getMileCardPassword } from '../../../../store/form/mileCard/selectors';
import Tooltip from '../../../UI/Tooltip';
import { i18n } from '../../../../i18n';
import Input from './MileCard/Input';
import { ApplicationState } from '../../../../state';
import { FormEvent } from 'react';

interface StateProps {
	number: string;
	password: string;
	showErrors: boolean;
}

interface DispatchProps {
	changeMileCardNumber: (newValue: string) => MileCardAction;
	changeMileCardPassword: (newValue: string) => MileCardAction;
}

interface State {
	isActive: boolean;
}

type Props = StateProps & DispatchProps & InjectedOnClickOutProps;

class MileCardContainer extends React.Component<Props, State> {
	state: State = {
		isActive: false
	};

	constructor(props: Props) {
		super(props);

		this.state = {
			isActive: !!this.props.number || !!this.props.password
		};

		this.enableField = this.enableField.bind(this);
		this.disableField = this.disableField.bind(this);
		this.changeMileCardNumber = this.changeMileCardNumber.bind(this);
		this.changeMileCardPassword = this.changeMileCardPassword.bind(this);
	}

	enableField(): void {
		this.setState({ isActive: true });
	}

	disableField(): void {
		this.props.changeMileCardNumber(null);
		this.props.changeMileCardPassword(null);
		this.setState({ isActive: false });
	}

	handleClickOutside(): void {
		if (this.state.isActive && !this.props.number && !this.props.password) {
			this.disableField();
		}
	}

	changeMileCardNumber(event: FormEvent<HTMLInputElement>): void {
		this.props.changeMileCardNumber((event.target as HTMLInputElement).value);
	}

	changeMileCardPassword(event: FormEvent<HTMLInputElement>): void {
		this.props.changeMileCardPassword((event.target as HTMLInputElement).value);
	}

	renderDummy(): React.ReactNode {
		return <div className="form-control widget-mileCard__dummy" onClick={this.enableField}>
			{i18n('mileCardDummy')}
			<i className="widget-ui-icon widget-mileCard__dummy__icon"/>
		</div>;
	}

	renderField(): React.ReactNode {
		const
			{ number, password, showErrors } = this.props,
			visiblePassword = password ? password : '',
			showNumberTooltip = showErrors && this.state.isActive && !(number && number.match(/^[\d]+$/g)),
			showPasswordTooltip = showErrors && this.state.isActive && !password;

		return <div className="widget-mileCard__wrapper">
			<Input
				onClose={this.disableField}
				changeMileCardNumber={this.changeMileCardNumber}
				number={number}
				showTooltip={showNumberTooltip}
			/>

			<div className="widget-mileCard__wrapper__block">
				<Tooltip message={i18n('mileCardPasswordError')} isActive={showPasswordTooltip} isCentered={true}>
					<input
						type="password"
						className="form-control"
						value={visiblePassword}
						spellCheck={false}
						onChange={this.changeMileCardPassword}
						placeholder={i18n('mileCardPasswordPlaceholder')}
					/>
				</Tooltip>
			</div>
		</div>;
	}

	render(): React.ReactNode {
		return <div className="widget-mileCard">
			{this.state.isActive ? this.renderField() : this.renderDummy()}
		</div>;
	}
}

const mapStateToProps = (state: ApplicationState): StateProps => {
	return {
		number: getMileCardNumber(state),
		password: getMileCardPassword(state),
		showErrors: state.form.showErrors
	};
};

const mapActionsToProps = (dispatch: Dispatch<AnyAction, any>): DispatchProps => {
	return {
		changeMileCardNumber: bindActionCreators(changeMileCardNumber, dispatch),
		changeMileCardPassword: bindActionCreators(changeMileCardPassword, dispatch)
	};
};

export default connect(mapStateToProps, mapActionsToProps)(onClickOutside(MileCardContainer));
