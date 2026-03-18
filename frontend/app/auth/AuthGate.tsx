import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase-client';
import { AuthPage } from './AuthPage';

type AuthGateProps = {
	children: ReactNode;
};

export const AuthGate = ({ children }: AuthGateProps) => {
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		supabase.auth
			.getSession()
			.then(({ data }) => {
				if (!mounted) return;
				setSession(data.session);
				setLoading(false);
			})
			.catch(() => {
				if (!mounted) return;
				setSession(null);
				setLoading(false);
			});

		const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
			setSession(nextSession);
			setLoading(false);
		});

		return () => {
			mounted = false;
			data.subscription.unsubscribe();
		};
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

	if (!session) {
		return <AuthPage />;
	}

	return <>{children}</>;
};
