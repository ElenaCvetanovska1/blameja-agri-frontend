// app/lib/api-client.ts
//
// Single HTTP client for all backend API calls.
// Replaces supabase-client.ts for data access.
// Auth tokens are stored in localStorage and sent as Bearer on every request.

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5132';

const TOKEN_KEY = 'blameja_access_token';
const REFRESH_KEY = 'blameja_refresh_token';

// ── Token storage ──────────────────────────────────────────────────────────

export const tokenStorage = {
	getAccessToken: () => localStorage.getItem(TOKEN_KEY),
	getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
	setTokens: (access: string, refresh: string) => {
		localStorage.setItem(TOKEN_KEY, access);
		localStorage.setItem(REFRESH_KEY, refresh);
	},
	clear: () => {
		localStorage.removeItem(TOKEN_KEY);
		localStorage.removeItem(REFRESH_KEY);
	},
};

// ── Token refresh ──────────────────────────────────────────────────────────

export type RefreshResult = 'ok' | 'invalid' | 'network';

/**
 * ⚠️ Supabase ги РОТИРА refresh токените: секој смее да се употреби само еднаш.
 * Два паралелни refresh повика (два таба, StrictMode двоен ефект, повеќе 401 одеднаш)
 * значат дека вториот користи веќе потрошен токен → Supabase ја укинува целата сесија.
 * Затоа: single-flight во табот + Web Locks заклучување низ сите табови.
 */
const doRefresh = async (): Promise<RefreshResult> => {
	// Друг таб можеби веќе обновил додека чекавме на бравата — тогаш сме готови.
	if (isTokenValid()) return 'ok';

	const refreshToken = tokenStorage.getRefreshToken();
	if (!refreshToken) return 'invalid';

	try {
		const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ refreshToken }),
		});

		if (!res.ok) return 'invalid';

		const data = await res.json();
		tokenStorage.setTokens(data.access_token, data.refresh_token);
		return 'ok';
	} catch {
		return 'network';
	}
};

let inflightRefresh: Promise<RefreshResult> | null = null;

/**
 * Exchange the stored refresh token for a fresh access/refresh pair.
 *  - 'ok'      → new tokens stored (или друг таб/повик веќе обновил)
 *  - 'invalid' → refresh token rejected (session really expired)
 *  - 'network' → backend unreachable — tokens are KEPT so the session
 *                survives a backend restart / network blip
 */
export const tryRefreshTokens = (): Promise<RefreshResult> => {
	if (inflightRefresh) return inflightRefresh;

	const withCrossTabLock = async (): Promise<RefreshResult> => {
		let result: RefreshResult = 'network';
		await navigator.locks.request('blameja-token-refresh', async () => {
			result = await doRefresh();
		});
		return result;
	};

	const run: Promise<RefreshResult> = typeof navigator !== 'undefined' && 'locks' in navigator ? withCrossTabLock() : doRefresh();

	const flight = run.finally(() => {
		inflightRefresh = null;
	});
	inflightRefresh = flight;
	return flight;
};

// ── Core fetch wrapper ─────────────────────────────────────────────────────

class ApiClient {
	private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
		const token = tokenStorage.getAccessToken();

		const res = await fetch(`${BASE_URL}${path}`, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				...(token ? { Authorization: `Bearer ${token}` } : {}),
				...(options.headers ?? {}),
			},
		});

		if (res.status === 401) {
			// Attempt a single token refresh, then retry (single-flight + cross-tab lock)
			const refreshed = await tryRefreshTokens();

			if (refreshed === 'invalid') {
				// Сесијата реално истекла — исчисти и покажи најава.
				tokenStorage.clear();
				window.location.reload();
				throw new Error('Session expired.');
			}

			if (refreshed === 'network') {
				// Бекендот е недостапен — НЕ ја уништувај сесијата, само пријави грешка.
				throw new Error('Серверот не е достапен. Обиди се повторно.');
			}

			// Retry the original request once with the new token
			return this.request<T>(path, options);
		}

		if (res.status === 204) return undefined as T;

		if (!res.ok) {
			let message = `HTTP ${res.status}`;
			try {
				const body = await res.json();
				message = body.error ?? message;
			} catch {
				// ignore parse errors
			}
			throw new Error(message);
		}

		return res.json() as Promise<T>;
	}

	// ── HTTP methods ─────────────────────────────────────────────────────

	get<T>(path: string): Promise<T> {
		return this.request<T>(path, { method: 'GET' });
	}

	post<T>(path: string, body?: unknown): Promise<T> {
		return this.request<T>(path, {
			method: 'POST',
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
	}

	put<T>(path: string, body: unknown): Promise<T> {
		return this.request<T>(path, {
			method: 'PUT',
			body: JSON.stringify(body),
		});
	}

	patch<T>(path: string, body: unknown): Promise<T> {
		return this.request<T>(path, {
			method: 'PATCH',
			body: JSON.stringify(body),
		});
	}
}

export const api = new ApiClient();

// ── Auth helpers ───────────────────────────────────────────────────────────

export type LoginResponse = {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	token_type: string;
};

/** Decode JWT payload without verification (for expiry check only). */
export const decodeTokenPayload = (token: string): Record<string, unknown> | null => {
	try {
		const payload = token.split('.')[1];
		return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
	} catch {
		return null;
	}
};

/** Returns true if the stored access token exists and is not expired. */
export const isTokenValid = (): boolean => {
	const token = tokenStorage.getAccessToken();
	if (!token) return false;

	const payload = decodeTokenPayload(token);
	if (!payload?.exp) return false;

	// exp is in seconds; add 30s buffer
	return (payload.exp as number) > Date.now() / 1000 + 30;
};

// ── Proactive session keep-alive ─────────────────────────────────────────────
//
// Access токенот трае ~1h. Без ова, штом истече додека апликацијата стои отворена/мирна,
// следната акција удира во истечен токен и обновувањето може да падне → одјава.
// Затоа ТИВКО обновуваме ~60s ПРЕД истек, додека апликацијата е отворена, па токенот
// никогаш не истекува во употреба. Дополнително обновуваме кога табот пак станува видлив.

let keepAliveTimer: ReturnType<typeof setTimeout> | null = null;
let onSessionExpired: (() => void) | null = null;

const accessTokenExpMs = (): number | null => {
	const token = tokenStorage.getAccessToken();
	if (!token) return null;
	const payload = decodeTokenPayload(token);
	return typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
};

const clearKeepAliveTimer = () => {
	if (keepAliveTimer) {
		clearTimeout(keepAliveTimer);
		keepAliveTimer = null;
	}
};

const scheduleKeepAlive = () => {
	clearKeepAliveTimer();
	const expMs = accessTokenExpMs();
	if (expMs == null) return;

	// Обнови 60s пред истек; но најмалку 5s од сега (за да не се врти веднаш).
	const delay = Math.max(expMs - Date.now() - 60_000, 5_000);

	keepAliveTimer = setTimeout(() => {
		void tryRefreshTokens().then((result) => {
			if (result === 'invalid') {
				clearKeepAliveTimer();
				tokenStorage.clear();
				onSessionExpired?.();
				return;
			}
			if (result === 'network') {
				// Серверот е недостапен — НЕ одјавувај; пробај повторно наскоро.
				clearKeepAliveTimer();
				keepAliveTimer = setTimeout(scheduleKeepAlive, 20_000);
				return;
			}
			scheduleKeepAlive(); // 'ok' → пресметај повторно од новиот токен
		});
	}, delay);
};

const onVisibilityChange = () => {
	if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
	const expMs = accessTokenExpMs();
	if (expMs == null) return;

	// Ако токенот е при крај (или веќе истечен) кога се враќаш во табот → обнови веднаш.
	if (expMs - Date.now() < 90_000) {
		void tryRefreshTokens().then((result) => {
			if (result === 'invalid') {
				tokenStorage.clear();
				onSessionExpired?.();
			} else {
				scheduleKeepAlive();
			}
		});
	} else {
		scheduleKeepAlive();
	}
};

/** Стартувај автоматско одржување на сесијата (се вика штом корисникот е најавен). */
export const startSessionKeepAlive = (onExpired: () => void) => {
	onSessionExpired = onExpired;
	scheduleKeepAlive();
	if (typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', onVisibilityChange);
	}
};

/** Запри го одржувањето (пр. при одјава). */
export const stopSessionKeepAlive = () => {
	clearKeepAliveTimer();
	onSessionExpired = null;
	if (typeof document !== 'undefined') {
		document.removeEventListener('visibilitychange', onVisibilityChange);
	}
};
