import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import './styles/app.css';
import { AuthGate } from './auth/AuthGate';

// singleton QueryClient
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			retry: 1,
			refetchOnWindowFocus: false,
		},
		mutations: {
			retry: 0,
		},
	},
});

export const Layout = ({ children }: { children: ReactNode }) => {
	return (
		<html lang="mk">
			<head>
				<meta charSet="utf-8" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1"
				/>
				<Meta />
				<Links />
			</head>
			<body>
				<StrictMode>
					<QueryClientProvider client={queryClient}>
						{children}

						{/* Global toaster for notifications */}
						<Toaster
							richColors
							position="top-right"
						/>
					</QueryClientProvider>
				</StrictMode>

				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
};

const App = () => {
	return (
		<AuthGate>
			<Outlet />
		</AuthGate>
	);
};
export default App;
