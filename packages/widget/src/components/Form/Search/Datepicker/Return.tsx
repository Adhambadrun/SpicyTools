import * as React from 'react';
import Datepicker from '../Datepicker';
import MobileHeader from '../../../UI/MobileHeader';
import { i18n } from '../../../../i18n';
import { DatepickerFieldType } from '../../../../state';

export default class Return extends Datepicker {
	protected type = DatepickerFieldType.Return;
	protected placeholder = i18n('dateBack');
	protected popperPlacement = 'top-end';
	protected isDisableable = true;

	closeDatepicker(): void {
		if (this.datepickerRef) {
			if (this.props.date) {
				this.datepickerRef.calendar.setOpen(false);
			}
			else {
				this.datepickerRef.disable();
			}
		}
	}

	renderInner(): React.ReactNode {
		const mobileHeaderClassName = `widget-ui-datepicker__header widget-ui-datepicker__header_${this.type}`;

		return <div>
			<MobileHeader className={mobileHeaderClassName} title={this.placeholder} onClose={this.closeDatepicker}/>

			<div className="widget-ui-datepicker__footer">
				<div className="widget-ui-datepicker__footer__button" onClick={() => {
					if (this.datepickerRef) {
						this.datepickerRef.disable();
						this.datepickerRef.calendar.setOpen(false);
					}
				}}>
					{i18n('noBackTicket')}
				</div>
			</div>
		</div>;
	}
}
