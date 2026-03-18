import type { TaxGroup } from './types';

export const KPK_CODE = 'kpk';
export const KPK_FISCAL_PLU = 80;

export const num = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : 0;
};

// ✅ NEW: PostgREST ilike escape (%, _ and \)
export const escapeLike = (input: string) => {
	return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
};

export const parseNumOrNull = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const n = Number.parseFloat(trimmed.replace(',', '.'));
	if (Number.isNaN(n)) return undefined;
	return n;
};

export const normalizeTaxGroup = (v: unknown): TaxGroup => {
	const tg = String(Math.trunc(num(v))) as TaxGroup;
	return tg === '5' || tg === '10' || tg === '18' ? tg : '18';
};