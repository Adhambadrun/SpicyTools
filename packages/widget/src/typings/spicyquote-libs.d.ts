// Ambient declarations for the two UI libraries the widget consumes through
// SpicyQuote-owned specifiers (see the aliases in webpack.common.js /
// tsconfig.json).
//
// They used to come from Nemo-published forks that shipped their own typings.
// Those forks are gone — the widget now uses the upstream originals
// (`react-select` v1, `react-datepicker` v2), neither of which bundles types
// for this major line (the DefinitelyTyped packages target later majors). So we
// declare the small surface we actually use rather than pulling in typings that
// describe a different API.

declare module '@spicyquote/react-select' {
	import * as React from 'react';

	export interface Option {
		value?: any;
		label?: any;
		[key: string]: any;
	}

	export interface ReactSelectProps {
		// The widget uses the v1 API: options/optionsGroup, clearable, autoBlur,
		// openOnFocus, filterOptions, custom renderers, etc. Anything goes.
		[key: string]: any;
	}

	export default class Select extends React.Component<ReactSelectProps, any> {}
}

declare module '@spicyquote/react-datepicker' {
	import * as React from 'react';

	export interface ReactDatePickerProps {
		[key: string]: any;
	}

	export default class DatePicker extends React.Component<ReactDatePickerProps, any> {}
}
