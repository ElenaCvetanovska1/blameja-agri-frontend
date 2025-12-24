import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [reactRouter(), tailwindcss()],
	resolve: {
		alias: {
			app: resolve(__dirname, 'app'),
		},
	},
	server: { open: true },
	build: { target: 'esnext' },
});
