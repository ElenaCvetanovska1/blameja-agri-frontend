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

// ── Core fetch wrapper ─────────────────────────────────────────────────────

class ApiClient {
	private refreshing: Promise<boolean> | null = null;

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
			// Attempt a single token refresh, then retry
			if (!this.refreshing) {
				this.refreshing = this.attemptRefresh();
			}
			const refreshed = await this.refreshing;
			this.refreshing = null;

			if (!refreshed) {
				tokenStorage.clear();
				// Trigger a full page reload so AuthGate shows the login screen
				window.location.reload();
				throw new Error('Session expired.');
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

	private async attemptRefresh(): Promise<boolean> {
		const refreshToken = tokenStorage.getRefreshToken();
		if (!refreshToken) return false;

		try {
			const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refreshToken }),
			});

			if (!res.ok) return false;

			const data = await res.json();
			tokenStorage.setTokens(data.access_token, data.refresh_token);
			return true;
		} catch {
			return false;
		}
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
