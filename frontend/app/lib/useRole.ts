// app/lib/useRole.ts
//
// Fetches the current user's role from public.profiles via /api/auth/me.
// Uses raw fetch instead of api-client so failures never trigger the
// api-client's automatic logout and reload flow.

import { useQuery } from '@tanstack/react-query';
import { tokenStorage } from './api-client';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5132';

type Role = 'admin' | 'seller';

export const useRole = () => {
	const { data, isLoading } = useQuery({
		queryKey: ['auth', 'me'],
		queryFn: async () => {
			const token = tokenStorage.getAccessToken();
			if (!token) return null;

			const res = await fetch(`${BASE_URL}/api/auth/me`, {
				headers: { Authorization: `Bearer ${token}` },
			});

			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json() as Promise<{ role: Role }>;
		},
		staleTime: Number.POSITIVE_INFINITY,
		retry: 2,
	});

	return {
		role: data?.role ?? null,
		isAdmin: data?.role === 'admin',
		isSeller: data?.role === 'seller',
		loading: isLoading,
	};
};
