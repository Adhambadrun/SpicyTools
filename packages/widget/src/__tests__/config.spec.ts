import { validateConfig } from '../config';
import { getStore } from '../store';

/* global describe */
/* global it */
/* global expect */

/**
 * `apiBase` is the documented way to point the widget at a SpicyTool API and
 * `spicyURL` is its deprecated alias. `getStore()` maps one onto the other,
 * but `init()` used to validate `spicyURL` *before* that mapping ran — so the
 * documented call `SpicyTools.init({ rootElement, apiBase })` threw. These
 * tests pin the contract down on both layers.
 */
describe('apiBase / spicyURL configuration', () => {
	// `validateConfig` also guards the mount target, so give it a stub element
	// — the widget suite renders nothing, it only checks the gate.
	const withRoot = (config: object) => ({ rootElement: {} as any, ...config });

	it('getStore exposes apiBase to the widget as spicyURL', () => {
		const state = getStore({ apiBase: 'https://fare.example.com', spicyURL: '' }).getState();

		expect(state.system.spicyURL).toBe('https://fare.example.com');
	});

	it('getStore keeps a legacy spicyURL when no apiBase is given', () => {
		const state = getStore({ spicyURL: 'https://legacy.example.com' }).getState();

		expect(state.system.spicyURL).toBe('https://legacy.example.com');
	});

	it('validateConfig accepts the documented apiBase without spicyURL', () => {
		expect(() => validateConfig(withRoot({ apiBase: 'https://fare.example.com' }) as any)).not.toThrow();
	});

	it('validateConfig still accepts the deprecated spicyURL alone', () => {
		expect(() => validateConfig(withRoot({ spicyURL: 'https://legacy.example.com' }) as any)).not.toThrow();
	});

	it('validateConfig rejects a configuration with neither apiBase nor spicyURL', () => {
		expect(() => validateConfig(withRoot({}) as any)).toThrow(/apiBase/);
	});

	it('validateConfig rejects a configuration without a root element', () => {
		expect(() => validateConfig({ apiBase: 'https://fare.example.com' } as any)).toThrow(/rootElement/);
	});
});
