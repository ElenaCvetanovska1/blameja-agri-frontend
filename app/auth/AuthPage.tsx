import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase-client';

export const AuthPage = () => {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');

	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const handleLogin = async (e: FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (error) {
			setError('Погрешен email или лозинка.');
			setLoading(false);
			return;
		}

		setLoading(false);
	};

	return (
		<div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
			<div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
				{/* Header */}
				<div className="p-6 sm:p-8 border-b border-slate-200">
					<div className="flex items-center justify-center">
						<div className="h-12 w-12 rounded-2xl bg-blamejaGreenSoft flex items-center justify-center">
							<span className="text-blamejaGreen font-bold text-lg">B</span>
						</div>
					</div>

					<p className="mt-4 text-center text-xs font-semibold tracking-[0.22em] uppercase text-blamejaGreen">Blameja</p>

					<h1 className="mt-2 text-center text-xl sm:text-2xl font-bold text-slate-800">Најава</h1>

					<p className="mt-1 text-center text-xs text-slate-500">Внеси ги пристапните податоци што ти ги додели администраторот.</p>
				</div>

				{/* Form */}
				<div className="p-6 sm:p-8">
					<form
						onSubmit={handleLogin}
						className="space-y-4"
					>
						<div className="space-y-1">
							<label className="block text-xs font-medium text-slate-600">Email</label>
							<input
								type="email"
								autoComplete="email"
								placeholder="user@blameja.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                           outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
							/>
						</div>

						<div className="space-y-1">
							<label className="block text-xs font-medium text-slate-600">Лозинка</label>
							<input
								type="password"
								autoComplete="current-password"
								placeholder="••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                           outline-none focus:ring-2 focus:ring-blamejaGreen/30 focus:border-blamejaGreen"
							/>
						</div>

						{error && <div className="text-xs text-blamejaRed bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</div>}

						<button
							type="submit"
							disabled={loading}
							className="w-full inline-flex justify-center items-center rounded-lg
                         bg-blamejaGreen px-3 py-2 text-sm font-semibold text-white shadow-sm
                         hover:bg-blamejaGreenDark focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blamejaGreen
                         disabled:opacity-60 disabled:cursor-not-allowed"
						>
							{loading ? 'Се најавувам...' : 'Најави се'}
						</button>

						<div className="pt-2">
							<p className="text-[11px] text-center text-slate-400">Пристап имаат само корисници претходно додадени во системот.</p>

							<div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-500">
								<span className="inline-block h-2 w-2 rounded-full bg-blamejaOrange" />
								<span>Интерен систем (без фискална)</span>
							</div>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
