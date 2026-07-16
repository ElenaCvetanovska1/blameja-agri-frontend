'use client';

import { useState } from 'react';
import { StatusTab } from './components/StatusTab';
import { ReportsTab } from './components/ReportsTab';
import { FiscalArticlesTab } from './components/FiscalArticlesTab';
import { ComparisonTab } from './components/ComparisonTab';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'status' | 'reports' | 'fiscalArticles' | 'items';

const TABS: { id: Tab; label: string }[] = [
	{ id: 'status', label: 'Статус' },
	{ id: 'reports', label: 'Извештаи' },
	{ id: 'fiscalArticles', label: 'Фискални артикли' },
	{ id: 'items', label: 'Споредба' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

const FiscalPage = () => {
	const [tab, setTab] = useState<Tab>('status');

	return (
		<div className="flex flex-col h-full min-h-0 gap-4">
			{/* Header — shrink-0 */}
			<div className="shrink-0">
				<h1 className="text-xl font-bold text-slate-900">Фискална</h1>
				<p className="mt-0.5 text-xs text-slate-500">Статус · Извештаи · Готово влезно/излезно · Артикли · Споредба со базата</p>
			</div>

			{/* Tabs — shrink-0 */}
			<div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-full sm:w-fit shrink-0">
				{TABS.map((t) => (
					<button
						key={t.id}
						type="button"
						onClick={() => setTab(t.id)}
						className={[
							'rounded-lg px-4 py-2 text-sm font-semibold transition',
							tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
						].join(' ')}
					>
						{t.label}
					</button>
				))}
			</div>

			{/* Content — flex-1, internal scroll */}
			<div className="flex-1 overflow-y-auto min-h-0 pb-2">
				{tab === 'status' && <StatusTab />}
				{tab === 'reports' && <ReportsTab />}
				{tab === 'fiscalArticles' && <FiscalArticlesTab />}
				{tab === 'items' && <ComparisonTab />}
			</div>
		</div>
	);
};

export default FiscalPage;
