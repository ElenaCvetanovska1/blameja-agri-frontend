// app/lib/useRole.ts
//
// Fetches the current user's role from public.profiles via /api/auth/me.
// Uses raw fetch (NOT the api-client) so failures never trigger the
// api-client's automatic logout + reload flow.
//
// On fetch error: throws → React Query retries (retry: 2, exponential backoff)
// On success with null token: returns null immediately, no retries needed

import { useQuery } from '@tanstack/react-query';
import { tokenStorage } from './api-client';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5132';

type Role = 'admin' | 'seller';

export const useRole = () => {
	const { data, isLoading } = useQuery({
		queryKey: ['auth', 'me'],
		queryFn: async () => {
			const token = tokenStorage.getAccessToken();
			if (!token) return null; // not logged in — no point retrying

			const res = await fetch(`${BASE_URL}/api/auth/me`, {
				headers: { Authorization: `Bearer ${token}` },
			});

			if (!res.ok) throw new Error(`HTTP ${res.status}`); // let React Query retry
			return res.json() as Promise<{ role: Role }>;
		},
		staleTime: Infinity, // role never changes mid-session — cache forever
		retry: 2, // retry up to 2 times on error (exponential backoff)
	});

	return {
		role: data?.role ?? null,
		isAdmin: data?.role === 'admin',
		isSeller: data?.role === 'seller',
		loading: isLoading,
	};
};
