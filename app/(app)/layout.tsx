import { useState } from "react";
import { Outlet, NavLink } from "react-router";
import { BLAMEJA_ROUTES } from "app/routes";
import { supabase } from "app/lib/supabase-client";

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkBase =
    "px-3 py-1 rounded-full text-sm transition-colors whitespace-nowrap";

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `${linkBase} ${
      isActive
        ? "bg-white text-blamejaGreen"
        : "text-white/90 hover:bg-white/10"
    }`;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* HEADER */}
      <header className="bg-blamejaGreen text-white px-4 sm:px-6 py-3 sm:py-4 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Logo + Brand */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo image (upload to /public/logo.png) */}
            <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center shrink-0">
              <img
                src="/logo.png"
                alt="Blameja logo"
                className="h-10 w-10 object-contain"
                onError={(e) => {
                  // fallback ако немаш лого уште
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>

            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-bold tracking-wide truncate">
                Blameja
              </div>
              <div className="text-[11px] text-white/80 truncate">
                Agricultural pharmacy
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Desktop nav */}
            <nav className="hidden md:flex gap-3">
              <NavLink to={BLAMEJA_ROUTES.home} className={navLinkClass}>
                Почетна
              </NavLink>
              <NavLink to={BLAMEJA_ROUTES.sales} className={navLinkClass}>
                Продажба
              </NavLink>
              <NavLink to={BLAMEJA_ROUTES.receive} className={navLinkClass}>
                Прием
              </NavLink>
              <NavLink to={BLAMEJA_ROUTES.stock} className={navLinkClass}>
                Залиха
              </NavLink>
              <NavLink to={BLAMEJA_ROUTES.finance} className={navLinkClass}>
                Финансии
              </NavLink>
            </nav>

            {/* Desktop logout */}
            <button
              type="button"
              onClick={handleLogout}
              className="hidden md:inline-flex items-center rounded-full border border-white/40 px-3 py-1 text-sm
                         text-white hover:bg-white/10 transition-colors"
            >
              Одјава
            </button>

            {/* Mobile hamburger */}
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-full border border-white/40 p-2 hover:bg-white/10 transition"
              aria-label="Toggle navigation"
              onClick={() => setMobileOpen((open) => !open)}
            >
              <span className="sr-only">Мени</span>
              <div className="space-y-1.5">
                <span
                  className={`block h-0.5 w-5 bg-white transition-transform ${
                    mobileOpen ? "translate-y-1.5 rotate-45" : ""
                  }`}
                />
                <span
                  className={`block h-0.5 w-5 bg-white transition-opacity ${
                    mobileOpen ? "opacity-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`block h-0.5 w-5 bg-white transition-transform ${
                    mobileOpen ? "-translate-y-1.5 -rotate-45" : ""
                  }`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
        {mobileOpen && (
          <div className="md:hidden mt-3 border-t border-white/15 pt-3">
            <div className="max-w-6xl mx-auto flex flex-col gap-2">
              <NavLink
                to={BLAMEJA_ROUTES.home}
                className={navLinkClass}
                onClick={() => setMobileOpen(false)}
              >
                Почетна
              </NavLink>
              
              <NavLink
                to={BLAMEJA_ROUTES.sales}
                className={navLinkClass}
                onClick={() => setMobileOpen(false)}
              >
                Продажба
              </NavLink>
              <NavLink
                to={BLAMEJA_ROUTES.receive}
                className={navLinkClass}
                onClick={() => setMobileOpen(false)}
              >
                Прием
              </NavLink>
              <NavLink
                to={BLAMEJA_ROUTES.stock}
                className={navLinkClass}
                onClick={() => setMobileOpen(false)}
              >
                Залиха
              </NavLink>
              <NavLink
                to={BLAMEJA_ROUTES.finance}
                className={navLinkClass}
                onClick={() => setMobileOpen(false)}
              >
                Финансии
              </NavLink>

              {/* Mobile logout */}
              <button
                type="button"
                onClick={handleLogout}
                className="mt-2 self-start px-3 py-1 rounded-full text-sm border border-white/40 text-white hover:bg-white/10 transition-colors"
              >
                Одјава
              </button>

              <div className="mt-2 text-[11px] text-white/70">
                Акцент:{" "}
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-blamejaOrange" />
                  портокалово
                </span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 px-4 py-6 sm:py-8 md:px-8 lg:px-16">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* FOOTER */}
      <footer className="px-4 sm:px-6 py-4 text-xs text-slate-500 text-center">
        © {new Date().getFullYear()} Blameja Agricultural Pharmacy
      </footer>
    </div>
  );
}
