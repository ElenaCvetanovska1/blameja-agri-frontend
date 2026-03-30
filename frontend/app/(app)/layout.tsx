import { useState } from 'react';
import { Outlet, NavLink } from 'react-router';
import { BLAMEJA_ROUTES } from 'app/routes';
import { api, tokenStorage } from 'app/lib/api-client';
import { useRole } from 'app/lib/useRole';
import {
	FiHome,
	FiShoppingCart,
	FiPackage,
	FiDatabase,
	FiBarChart2,
	FiTruck,
	FiFileText,
	FiCpu,
	FiLogOut,
	FiMenu,
	FiX,
} from 'react-icons/fi';

type NavItem = {
	to: string;
	label: string;
	Icon: React.ElementType;
	adminOnly?: boolean;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
	{
		label: 'Операции',
		items: [
			{ to: BLAMEJA_ROUTES.sales, label: 'Продажба', Icon: FiShoppingCart },
			{ to: BLAMEJA_ROUTES.receive, label: 'Прием', Icon: FiPackage },
			{ to: BLAMEJA_ROUTES.stock, label: 'Залиха', Icon: FiDatabase },
		],
	},
	{
		label: 'Документи',
		items: [
			{ to: BLAMEJA_ROUTES.dispatch, label: 'Испратница', Icon: FiTruck },
			{ to: BLAMEJA_ROUTES.fiscalReceipts, label: 'Сторно', Icon: FiFileText },
		],
	},
	{
		label: 'Систем',
		items: [
			{ to: BLAMEJA_ROUTES.finance, label: 'Финансии', Icon: FiBarChart2, adminOnly: true },
			{ to: BLAMEJA_ROUTES.fiscal, label: 'Фискална', Icon: FiCpu },
		],
	},
];

/* ─── Sidebar gradient — deep, rich forest green ─── */
const SIDEBAR_STYLE: React.CSSProperties = {
	background: 'linear-gradient(170deg, #1c7535 0%, #145a28 25%, #0f451e 55%, #0a3416 80%, #062b11 100%)',
	boxShadow: '4px 0 32px 0 rgba(0,0,0,.22), inset -1px 0 0 rgba(255,255,255,.06)',
};

const AppLayout = () => {
	const [mobileOpen, setMobileOpen] = useState(false);
	const { role } = useRole();

	const handleLogout = async () => {
		try {
			await api.post('/api/auth/logout');
		} catch {
			// ignore — clear tokens regardless
		}
		tokenStorage.clear();
		setMobileOpen(false);
		window.location.reload();
	};

	const navLinkClass = ({ isActive }: { isActive: boolean }) =>
		isActive
			? 'flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white text-emerald-900 font-bold shadow-md text-sm'
			: 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/65 hover:bg-white/[0.08] hover:text-white transition-colors text-sm';

	return (
		<div className="flex bg-slate-100 min-h-screen lg:h-screen lg:overflow-hidden">
			{/* ═══════════════════════════════════════
			    SIDEBAR — desktop only, fixed
			═══════════════════════════════════════ */}
			<aside
				className="fixed left-0 top-0 h-screen w-[240px] flex flex-col z-30 hidden lg:flex"
				style={SIDEBAR_STYLE}
			>
				{/* Diagonal texture overlay */}
				<div className="sidebar-texture absolute inset-0 pointer-events-none" />

				{/* Top accent stripe */}
				<div
					className="absolute top-0 left-0 right-0 h-[2px] z-20"
					style={{ background: 'linear-gradient(90deg, #34d399 0%, #6ee7b7 50%, #34d399 100%)' }}
				/>

				{/* Bottom inner glow */}
				<div
					className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none z-0"
					style={{ background: 'radial-gradient(ellipse at 50% 120%, rgba(52,211,153,.08) 0%, transparent 70%)' }}
				/>

				{/* ── Logo section ── */}
				<div className="relative z-10 px-5 pt-7 pb-5">
					<div className="flex items-center gap-3">
						<div
							className="h-11 w-11 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-white/15"
							style={{ background: 'rgba(255,255,255,.1)', backdropFilter: 'blur(4px)' }}
						>
							<img
								src="/logo.png"
								alt="Blameja logo"
								className="h-11 w-11 object-contain"
								onError={(e) => {
									(e.currentTarget as HTMLImageElement).style.display = 'none';
								}}
							/>
						</div>
						<div>
							<div className="text-white font-extrabold text-[15px] tracking-wide leading-tight">Blameja</div>
							<div className="text-white/45 text-[9px] font-semibold tracking-[.15em] uppercase mt-0.5">Агро Аптека</div>
						</div>
					</div>
					<div className="mt-4 h-px bg-white/[0.08]" />
				</div>

				{/* ── Navigation ── */}
				<nav className="relative z-10 flex-1 px-3 pb-2 overflow-y-auto space-y-4">
					{NAV_GROUPS.map((group) => {
						const visibleItems = group.items.filter((item) => !item.adminOnly || role === 'admin');
						if (visibleItems.length === 0) return null;
						return (
							<div key={group.label}>
								<div className="px-3 mb-1 text-[9px] font-extrabold uppercase tracking-[.18em] text-white/30 select-none">
									{group.label}
								</div>
								<div className="space-y-0.5">
									{visibleItems.map((item) => (
										<NavLink
											key={item.to}
											to={item.to}
											className={navLinkClass}
										>
											<item.Icon className="w-[15px] h-[15px] shrink-0" />
											<span className="tracking-tight">{item.label}</span>
										</NavLink>
									))}
								</div>
							</div>
						);
					})}
				</nav>

				{/* ── Bottom: logout ── */}
				<div className="relative z-10 px-3 pb-5 pt-3">
					<div className="h-px bg-white/[0.08] mb-3" />
					<button
						type="button"
						onClick={handleLogout}
						className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-white/55 hover:bg-white/[0.08] hover:text-white/80 transition-colors text-sm"
					>
						<FiLogOut className="w-[15px] h-[15px] shrink-0" />
						<span>Одјава</span>
					</button>
					<div className="px-3 mt-1.5 text-[9px] text-white/20 select-none tracking-wide">© {new Date().getFullYear()} Blameja</div>
				</div>
			</aside>

			{/* ═══════════════════════════════════════
			    MOBILE HEADER
			═══════════════════════════════════════ */}
			<div className="lg:hidden fixed top-0 left-0 right-0 z-40">
				<header
					className="flex items-center justify-between px-4 py-3 shadow-lg"
					style={{ background: 'linear-gradient(90deg, #145a28 0%, #0f451e 100%)' }}
				>
					<div className="flex items-center gap-3">
						<div className="h-8 w-8 rounded-lg bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center">
							<img
								src="/logo.png"
								alt="Blameja"
								className="h-8 w-8 object-contain"
								onError={(e) => {
									(e.currentTarget as HTMLImageElement).style.display = 'none';
								}}
							/>
						</div>
						<span className="text-white font-bold text-base tracking-wide">Blameja</span>
					</div>
					<button
						type="button"
						onClick={() => setMobileOpen((o) => !o)}
						className="rounded-lg border border-white/25 p-2 text-white hover:bg-white/10 transition"
						aria-label="Toggle menu"
					>
						{mobileOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
					</button>
				</header>

				{/* Mobile nav drawer */}
				{mobileOpen && (
					<div
						className="border-t border-white/10 px-3 pb-4 shadow-xl"
						style={SIDEBAR_STYLE}
					>
						<div className="sidebar-texture absolute inset-0 pointer-events-none" />
						<nav className="relative z-10 pt-3 space-y-4">
							{NAV_GROUPS.map((group) => {
								const visibleItems = group.items.filter((item) => !item.adminOnly || role === 'admin');
								if (visibleItems.length === 0) return null;
								return (
									<div key={group.label}>
										<div className="px-3 mb-1 text-[9px] font-extrabold uppercase tracking-[.18em] text-white/30">{group.label}</div>
										{visibleItems.map((item) => (
											<NavLink
												key={item.to}
												to={item.to}
												className={navLinkClass}
												onClick={() => setMobileOpen(false)}
											>
												<item.Icon className="w-[15px] h-[15px] shrink-0" />
												<span>{item.label}</span>
											</NavLink>
										))}
									</div>
								);
							})}
							<div className="h-px bg-white/[0.08]" />
							<button
								type="button"
								onClick={handleLogout}
								className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-white/55 hover:bg-white/[0.08] hover:text-white/80 transition-colors text-sm"
							>
								<FiLogOut className="w-[15px] h-[15px]" />
								<span>Одјава</span>
							</button>
						</nav>
					</div>
				)}
			</div>

			{/* ═══════════════════════════════════════
			    MAIN CONTENT AREA
			    Desktop: fixed height, inner scroll
			    Mobile: normal flow
			═══════════════════════════════════════ */}
			<div className="flex-1 lg:ml-[240px] flex flex-col min-h-screen lg:min-h-0 lg:h-screen lg:overflow-hidden">
				<main className="flex-1 flex flex-col mt-[52px] lg:mt-0 pt-4 pb-6 lg:pb-4 px-4 lg:px-6 lg:overflow-hidden lg:min-h-0 gap-0">
					<Outlet />
				</main>
			</div>
		</div>
	);
};

export default AppLayout;
