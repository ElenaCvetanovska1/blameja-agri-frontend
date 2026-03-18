import { useEffect, useState, type ReactNode } from 'react';
import { isTokenValid, tokenStorage } from '../lib/api-client';
import { AuthPage } from './AuthPage';

type AuthGateProps = {
	children: ReactNode;
};

export const AuthGate = ({ children }: AuthGateProps) => {
	const [authenticated, setAuthenticated] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Check if a valid (non-expired) access token is present in localStorage.
		// Token refresh on expiry is handled transparently by the api-client on
		// any API call that returns 401. No Supabase SDK needed here.
		const valid = isTokenValid();

		if (!valid) {
			// Token missing or expired — clear stale tokens and show login
			tokenStorage.clear();
			setAuthenticated(false);
		} else {
			setAuthenticated(true);
		}

		setLoading(false);
	}, []);

	if (loading) {
		return (
			<div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
				<div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<div className="flex items-center gap-3">
						<div className="h-10 w-10 rounded-xl bg-blamejaGreenSoft flex items-center justify-center">
							<div className="h-5 w-5 rounded-full border-2 border-blamejaGreen border-t-transparent animate-spin" />
						</div>

						<div>
							<p className="text-sm font-semibold text-slate-800">Blameja Agricultural Pharmacy</p>
							<p className="text-xs text-slate-500">Вчитување на сесија…</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (!authenticated) {
		return <AuthPage />;
	}

	return <>{children}</>;
};
