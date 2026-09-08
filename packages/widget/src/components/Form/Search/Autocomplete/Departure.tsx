import Autocomplete from '../Autocomplete';
import { i18n } from '../../../../i18n';
import { AutocompleteFieldType } from '../../../../state';

class Departure extends Autocomplete {
	protected type = AutocompleteFieldType.Departure;
	protected placeholder = i18n('from_full');
	protected mobileTitle = i18n('from');
	protected defaultErrorText = i18n('departureError');
}

export default Departure;
