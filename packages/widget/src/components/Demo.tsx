import * as React from 'react';
import { Store } from 'redux';
import { Provider } from 'react-redux';
import Main from './Main';
import { getStore } from '../store';
import { ApplicationMode, ApplicationState, SystemState, systemState } from '../state';
import * as Cache from '../cache';
import CodeBlock from './UI/CodeBlock';
import { Language } from '../state';

interface DemoFormState {
	webskyURL: string;
	spicyURL: string;
	generatedConfig: string;
}

const defaultLang = Language.Russian;
const defaultWebskyURL = 'http://demo.websky.aero/gru';
// SpicyTool API used by the playground — point `apiBase` at your own.
const defaultSpicyURL = 'https://api.spicytools.app';

export default class Demo extends React.Component<any, DemoFormState> {
	config: SystemState = {
		...systemState,
		locale: defaultLang,
		webskyURL: defaultWebskyURL,
		spicyURL: defaultSpicyURL,
		disableCaching: true
	};

	store: Store<ApplicationState> = getStore({
		locale: defaultLang
	});

	state: DemoFormState = {
		webskyURL: defaultWebskyURL,
		spicyURL: defaultSpicyURL,
		generatedConfig: ''
	};

	constructor(props: any) {
		super(props);

		this.textAreaClickHandler = this.textAreaClickHandler.bind(this);
	}

	componentDidMount(): void {
		Cache.set(Cache.KEY_LOCALE, defaultLang);

		this.store.subscribe(() => {
			this.setState({
				generatedConfig: JSON.stringify(this.config)
			});
		});

		this.processConfig();
	}

	processConfig(): void {
		this.store.dispatch({
			type: 'LOAD_CONFIG',
			payload: this.config
		});
	}

	textAreaClickHandler(event: React.MouseEvent<HTMLTextAreaElement>): void {
		if (event.target instanceof HTMLTextAreaElement) {
			event.target.select();
		}
	}

	render(): React.ReactNode {
		const numOfTextAreaRows = 10;

		return <div className="widget-demo">

			<div className="form widget-demo-config">
				<h3>Widget options</h3>

				<div className="widget-demo-config__information row">
					<div className="col">
						<p>Flip any option below and the form re-renders instantly.</p>
						<p>
							The full list of options lives in the repository README:&nbsp;
							<a href="https://github.com/Adhambadrun/SpicyQuote#configuration">https://github.com/Adhambadrun/SpicyQuote#configuration</a>
						</p>
					</div>
				</div>

				<div className="row widget-demo-config__inputBlock">
					<div className="col form-group">
						<label>
							<div className="widget-demo-config__description">
								Config handed to init():
								<CodeBlock>SpicyTools.init(...config)</CodeBlock>
							</div>

							<textarea className="form-control" rows={numOfTextAreaRows} value={this.state.generatedConfig} onClick={this.textAreaClickHandler} spellCheck={false}/>
						</label>
					</div>
				</div>

				<div className="row widget-demo-config__inputBlock">
					<div className="col form-group">
						<label>
							<div className="widget-demo-config__description">
								<CodeBlock>webskyURL</CodeBlock>: URL of the Websky booking system
							</div>

							<input type="text" className="form-control" value={this.state.webskyURL} placeholder="http://demo.websky.aero/gru" onChange={e => {
								this.config.webskyURL = e.target.value;
								this.setState({
									webskyURL: e.target.value
								});
								this.processConfig();
							}}/>
						</label>
					</div>
				</div>

				<div className="row widget-demo-config__inputBlock">
					<div className="col form-group">
						<label>
							<div className="widget-demo-config__description">
								<CodeBlock>spicyURL</CodeBlock>: URL of the fare API
							</div>

							<input type="text" className="form-control" value={this.state.spicyURL} placeholder="https://api.spicytools.app" onChange={e => {
								this.config.spicyURL = e.target.value;
								this.setState({
									spicyURL: e.target.value
								});
								this.processConfig();
							}}/>
						</label>
					</div>
				</div>

				<div className="row widget-demo-config__inputBlock">
					<div className="col form-group">
						<label>
							<div className="widget-demo-config__description">
								<CodeBlock>routingGrid</CodeBlock>: airline whose route grid drives the autocomplete (fare API mode only)
							</div>

							<input type="text" className="form-control" placeholder="airline IATA code" onChange={e => {
								this.config.routingGrid = e.target.value;
								this.processConfig();
							}}/>
						</label>
					</div>
				</div>

				<div className="row widget-demo-config__inputBlock">
					<div className="col form-group">
						<label>
							<div className="widget-demo-config__description">
								<CodeBlock>mode</CodeBlock>: booking system to talk to
							</div>

							<select className="form-control" onChange={e => {
								this.config.mode = e.target.value as ApplicationMode;
								this.processConfig();
							}}>
								<option value="SPICY">SPICY</option>
								<option value="WEBSKY">WEBSKY</option>
							</select>
						</label>
					</div>
				</div>

				<div className="row">
					<div className="col form-check">
						<label className="form-check-label">
							<input type="checkbox" className="form-check-input" onChange={e => {
								this.config.verticalForm = e.target.checked;
								this.processConfig();
							}}/>
							<CodeBlock>verticalForm</CodeBlock>: stack the form vertically
						</label>
					</div>
				</div>

				<div className="row">
					<div className="col form-check">
						<label className="form-check-label">
							<input type="checkbox" className="form-check-input" onChange={e => {
								this.config.readOnlyAutocomplete = e.target.checked;
								this.processConfig();
							}}/>
							<CodeBlock>readOnlyAutocomplete</CodeBlock>: pick airports from a list instead of typing (Websky mode, or fare API mode with routingGrid set)
							<CodeBlock>routingGrid</CodeBlock>
						</label>
					</div>
				</div>

				<div className="row">
					<div className="col form-check">
						<label className="form-check-label">
							<input type="checkbox" className="form-check-input" onChange={e => {
								this.config.autoFocusArrivalAirport = e.target.checked;
								this.processConfig();
							}}/>
							<CodeBlock>autoFocusArrivalAirport</CodeBlock>: focus the arrival field right after the departure airport is picked
						</label>
					</div>
				</div>

				<div className="row">
					<div className="col form-check">
						<label className="form-check-label">
							<input type="checkbox" className="form-check-input" onChange={e => {
								this.config.autoFocusReturnDate = e.target.checked;
								this.processConfig();
							}}/>
							<CodeBlock>autoFocusReturnDate</CodeBlock>: focus the return date right after the departure date is picked
						</label>
					</div>
				</div>

				<div className="row">
					<div className="col form-check">
						<label className="form-check-label">
							<input type="checkbox" className="form-check-input" onChange={e => {
								this.config.highlightAvailableDates = e.target.checked;
								this.processConfig();
							}}/>
							<CodeBlock>highlightAvailableDates</CodeBlock>: highlight the dates that actually have flights (Websky mode)
						</label>
					</div>
				</div>

				<div className="row">
					<div className="col form-check">
						<label className="form-check-label">
							<input type="checkbox" className="form-check-input" onChange={e => {
								this.config.enableCoupon = e.target.checked;
								this.processConfig();
							}}/>
							<CodeBlock>enableCoupon</CodeBlock>: adds an “I have a discount coupon” field (Websky mode)
						</label>
					</div>
				</div>

				<div className="row" style={{ display: 'none' }}>
					<div className="col form-check">
						<label className="form-check-label">
							<input type="checkbox" className="form-check-input" onChange={e => {
								this.config.enableMileCard = e.target.checked;
								this.processConfig();
							}}/>
							<CodeBlock>enableMileCard</CodeBlock>: adds a “pay with miles” field (Websky mode)
						</label>
					</div>
				</div>


				<div className="row">
					<div className="col form-check">
						<label className="form-check-label">
							<input type="checkbox" className="form-check-input" onChange={e => {
								this.config.openNewTab = e.target.checked;
								this.processConfig();
							}}/>
							<CodeBlock>openNewTab</CodeBlock>: open the search results in a new tab
						</label>
					</div>
				</div>

				<div className="row">
					<div className="col form-check">
						<label className="form-check-label">
							<input type="checkbox" className="form-check-input" onChange={e => {
								this.config.isAWP = e.target.checked;
								this.processConfig();
							}}/>
							<CodeBlock>isAWP</CodeBlock>: for fare API projects running Avia Widget Pro
						</label>
					</div>
				</div>

				<div className="row">
					<div className="col form-check">
						<label className="form-check-label">
							<input type="checkbox" className="form-check-input" onChange={e => {
								this.config.citiesOnly = e.target.checked;
								this.processConfig();
							}}/>
							<CodeBlock>citiesOnly</CodeBlock>: hide the airports inside a city and offer the city instead
						</label>
					</div>
				</div>
			</div>

			<div className="widget-demo-content">
				<Provider store={this.store}>
					<Main/>
				</Provider>
			</div>
		</div>;
	}
}
