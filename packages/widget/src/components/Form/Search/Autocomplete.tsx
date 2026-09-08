import * as React from 'react';
import * as classnames from 'classnames';
import Select from '@spicytools/react-select';
import MobileHeader from '../../UI/MobileHeader';
import Tooltip from '../../UI/Tooltip';
import Option from './Autocomplete/Option';
import Value from './Autocomplete/Value';
import { i18n } from '../../../i18n';
import { DefaultOptionGroup } from '../../../store/form/selectors';
import { AutocompleteFieldType, CommonThunkAction } from '../../../state';
import { AutocompleteAction, runAutocompleteRequest } from '../../../store/form/segments/autocomplete/actions';
import { AutocompleteOption } from '../../../services/models/AutocompleteOption';
import { Airport } from '../../../services/models/Airport';

interface Props {
	isLoading?: boolean;
	suggestions?: AutocompleteOption[];
	optionsGroup?: DefaultOptionGroup[];
	sameAirportsError?: boolean;
	airport?: Airport;
	readOnly?: boolean;
	isGridMode?: boolean;
	showErrors: boolean;
	segmentId: number;

	selectAirport: (airport: any, autocompleteType: AutocompleteFieldType, segmentId: number) => any;
	sendAutocompleteRequest: typeof runAutocompleteRequest;
	changeAutocompleteSuggestions: (suggestions: any[], autocompleteType: AutocompleteFieldType, segmentId: number) => AutocompleteAction;
	swapAirports?: (segmentId: number) => CommonThunkAction;
	getRef?: (reactSelect: any) => any;
	forceAutocompleteFetch?: boolean;
}

interface State {
	isFocused: boolean;
}

export default class Autocomplete extends React.Component<Props, State> {
	state: State = {
		isFocused: false
	};

	protected autocompleteTimeout: number = null;
	protected autocompleteWaitTime = 200;
	protected type: AutocompleteFieldType = null;
	protected placeholder = '';
	protected mobileTitle = '';
	protected defaultErrorText = '';
	protected sameAirportsErrorText = i18n('sameAirportsError');

	constructor(props: Props) {
		super(props);

		this.onFocusHandler = this.onFocusHandler.bind(this);
		this.selectOption = this.selectOption.bind(this);
		this.onChangeHandler = this.onChangeHandler.bind(this);
	}

	/**
	 * Load autocomplete suggestions by given search string.
	 *
	 * @param {String} searchText
	 */
	fetchSuggestions(searchText: string = ''): void {
		const { sendAutocompleteRequest, segmentId } = this.props;

		if (searchText || (this.props.isGridMode && !this.props.suggestions.length || this.props.forceAutocompleteFetch)) {
			// We don't want to harass servers too much.
			clearTimeout(this.autocompleteTimeout);

			// So we send request only if user hasn't been typing something for a while.
			this.autocompleteTimeout = window.setTimeout(() => {
				sendAutocompleteRequest(searchText, this.type, segmentId);
			}, this.autocompleteWaitTime);
		}
	}

	/**
	 * Change autocomplete value.
	 *
	 * @param {String} searchString
	 */
	onChangeHandler(searchString: string): string {
		if (!this.props.isGridMode) {
			this.fetchSuggestions(searchString);
		}

		return searchString;
	}

	onFocusHandler(): void {
		const IPHONE_SCREEN_SIZE = 651;

		// https://support.spicytools.travel/issues/52266
		if (
			window.innerWidth < IPHONE_SCREEN_SIZE &&
			navigator.vendor &&
			navigator.vendor.indexOf('Apple') > -1 &&
			navigator.userAgent &&
			navigator.userAgent.indexOf('CriOS') === -1 &&
			navigator.userAgent.indexOf('FxiOS') === -1
		) {
			const POPUP_SHOW_INTERVAL = 50;
			const POPUP_HIDE_INTERVAL = 2000;
			const safariPopupTimer = setInterval(() => window.scroll(0, 1), POPUP_SHOW_INTERVAL);
			setTimeout(() => clearInterval(safariPopupTimer), POPUP_HIDE_INTERVAL);
		}

		this.setState({ isFocused: true } as State);
		this.fetchSuggestions();
	}

	/**
	 * Render airport IATA code hint.
	 *
	 * @returns {*}
	 */
	renderAirportCode(): React.ReactNode {
		const { airport, isLoading } = this.props;

		const className = classnames(
			'widget-airports__airportCode',
			{ 'widget-airports__airportCode_withArrow': this.props.isGridMode }
		);

		return airport && !isLoading ? <span className={className}>{airport.IATA}</span> : null;
	}

	/**
	 * Render airport swapper.
	 *
	 * @returns {*}
	 */
	renderSwitcher(): React.ReactNode {
		return null;
	}

	/**
	 * Set selected airport to the state.
	 *
	 * @param {Object} option
	 */
	selectOption(option: any): void {
		if (option && option.value && option.value.airport) {
			this.props.selectAirport(option.value.airport, this.type, this.props.segmentId);
		}
	}

	shouldComponentUpdate(nextProps: Props, nextState: State): boolean {
		const { showErrors, suggestions, isLoading, airport, sameAirportsError, isGridMode, readOnly } = this.props;

		return this.state.isFocused !== nextState.isFocused ||
			showErrors !== nextProps.showErrors ||
			sameAirportsError !== nextProps.sameAirportsError ||
			isGridMode !== nextProps.isGridMode ||
			readOnly !== nextProps.readOnly ||
			suggestions !== nextProps.suggestions ||
			airport !== nextProps.airport ||
			isLoading !== nextProps.isLoading;
	}

	render(): React.ReactNode {
		const { suggestions, isLoading, optionsGroup, airport, showErrors, sameAirportsError, readOnly, getRef, segmentId } = this.props;

		const selectedValue = airport ? {
			label: airport.name,
			value: airport as any
		} : null;

		const mobileHeaderClassName = classnames(
			'widget-airports__header',
			{ 'widget-airports__header_visible': this.state.isFocused }
		);

		const errorText = sameAirportsError ? this.sameAirportsErrorText : this.defaultErrorText;

		return <div className="widget-airports__col">
			<MobileHeader title={this.mobileTitle} className={mobileHeaderClassName}>
				<div className="widget-airports__underlay"/>
			</MobileHeader>

			<div className="widget-airports__select__wrapper">
				<Tooltip isActive={(!airport || sameAirportsError) && showErrors} isCentered={true} message={errorText}>
					<Select
						ref={getRef}
						clearable={false}
						autoBlur={true}
						autosize={false}
						spaceSelectsValue={false}
						noResultsText={i18n('noResults')}
						openOnFocus={true}
						backspaceRemoves={false}
						className={classnames('widget-airports__select', { 'widget-airports__select_readOnly': readOnly && this.props.isGridMode })}
						value={selectedValue}
						options={suggestions}
						optionsGroup={optionsGroup}
						isLoading={isLoading}
						onInputChange={this.onChangeHandler}
						placeholder={this.placeholder}
						onChange={this.selectOption}
						onFocus={this.onFocusHandler}
						filterOptions={this.props.isGridMode ? undefined : (options: any) => options}
						onBlur={() => {
							this.props.changeAutocompleteSuggestions([], this.type, segmentId);
							this.setState({ isFocused: false });
						}}
						optionRenderer={(option: any) => <Option option={option}/>}
						valueRenderer={(value: any) =>
							<Value value={value} placeholder={this.placeholder} readOnly={readOnly && this.props.isGridMode}/>}
						arrowRenderer={() => this.props.isGridMode ?
							<div className="widget-ui-icon widget-ui-input__arrow"/> : null}
						inputProps={{
							spellCheck: false,
							readOnly: readOnly && this.props.isGridMode
						}}
					/>
				</Tooltip>

				{this.renderAirportCode()}
				{this.renderSwitcher()}
			</div>
		</div>;
	}
}
