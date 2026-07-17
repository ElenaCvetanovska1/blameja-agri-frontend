import { useEffect, useState, type ReactNode } from 'react';
import { isTokenValid, startSessionKeepAlive, stopSessionKeepAlive, tokenStorage, tryRefreshTokens } from '../lib/api-client';
import { AuthPage } from './AuthPage';

type AuthGateProps = {
	children: ReactNode;
};

export const AuthGate = ({ children }: AuthGateProps) => {
	const [authenticated, setAuthenticated] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		const check = async () => {
			// Валиден (неистечен) access токен → директно внатре.
			if (isTokenValid()) {
				if (!cancelled) {
					setAuthenticated(true);
					setLoading(false);
				}
				return;
			}

			// Access токенот е истечен, но refresh токенот може уште да важи —
			// пробај ТИВКО обновување наместо да ја уништиш сесијата.
			// (Порано тука се бришеа двата токени → непотребна одјава по >1ч неактивност.)
			const result = await tryRefreshTokens();

			if (cancelled) return;

			if (result === 'ok') {
				setAuthenticated(true);
			} else {
				// 'invalid' → сесијата реално истекла; 'network' → бекенд недостапен,
				// но токените ги ЧУВАМЕ за да преживее сесијата рестарт на серверот.
				if (result === 'invalid') tokenStorage.clear();
				setAuthenticated(false);
			}
			setLoading(false);
		};

		void check();
		return () => {
			cancelled = true;
		};
	}, []);

	// Додека корисникот е најавен — тивко одржувај ја сесијата жива (обнови пред истек).
	useEffect(() => {
		if (!authenticated) return;
		startSessionKeepAlive(() => {
			// Сесијата реално истече — врати на најава.
			tokenStorage.clear();
			setAuthenticated(false);
		});
		return () => stopSessionKeepAlive();
	}, [authenticated]);

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
