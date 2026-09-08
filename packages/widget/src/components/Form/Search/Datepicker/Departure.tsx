import Datepicker from '../Datepicker';
import { i18n } from '../../../../i18n';
import { DatepickerFieldType } from '../../../../state';
import { Moment } from 'moment';

export default class Departure extends Datepicker {
	protected type = DatepickerFieldType.Departure;
	protected popperPlacement = 'top-start';
	protected tooltipText = i18n('dateToError');
	protected showErrors = true;
}
