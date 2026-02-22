import { index, layout, route, type RouteConfigEntry } from '@react-router/dev/routes';

export const BLAMEJA_ROUTES = {
	home: '/',
	products: '/products',
	sales: '/sales',
	receive: '/receive',
	stock: '/stock',
	finance: '/finance',
	qr: '/qr',
	settings: '/settings',
	dispatch: '/dispatch',
} as const;

export default [
	layout('(app)/layout.tsx', [
		index('(app)/(index)/page.tsx'),

		route('sales', '(app)/(sales)/page.tsx'),
		route('receive', '(app)/(receive)/page.tsx'),
		route('stock', '(app)/(stock)/page.tsx'),
		route('finance', '(app)/(finance)/page.tsx'),
		route('dispatch', '(app)/(dispatch)/page.tsx'),
	]),
] satisfies RouteConfigEntry[];
