'use client';

import { toast } from 'sonner';
import type { StockRow } from '../hooks/useStock';
import { useDeactivateProductMutation } from '../hooks/useDeactivateProductMutation';

type Props = {
	open: boolean;
	row: StockRow | null;
	onClose: () => void;
};

const num = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : 0;
};

const fmtQty = (n: number) => (Number.isFinite(n) ? n.toFixed(3).replace(/\.?0+$/, '') : '0');

export function DeleteProductModal({ open, row, onClose }: Props) {
	const deactivateProduct = useDeactivateProductMutation();

	if (!open || !row) return null;

	const name = row.name ?? '—';
	const plu = row.plu ?? '—';
	const barcode = row.barcode ?? '—';
	const qty = fmtQty(num(row.qty_on_hand));
	const lastMovement = row.last_movement_at != null ? new Date(row.last_movement_at).toLocaleString('mk-MK') : '—';

	const handleDelete = async () => {
		try {
			await deactivateProduct.mutateAsync({
				productId: row.product_id,
				clearCodes: true, // ослободи PLU + barcode
			});
			touchToast();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Грешка при бришење.');
		}
	};

	const touchToast = () => {
		toast.success('Производот е избришан (деактивиран) ✅');
		onClose();
	};

	const isBusy = deactivateProduct.isPending;

	return (
		<div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center px-4">
			<div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
				<div className="border-b border-slate-200 px-4 py-3">
					<div className="text-sm font-semibold text-slate-900">Потврда за бришење</div>
					<div className="text-xs text-slate-500 mt-1">Дали сте сигурни дека сакате да го избришете овој производ?</div>
				</div>

				<div className="p-4 text-sm text-slate-700 space-y-2">
					<div>
						<b>Име:</b> {name}
					</div>
					<div className="text-xs text-slate-600 space-y-1">
						<div>
							<b>PLU:</b> {plu}
						</div>
						<div>
							<b>Баркод:</b> {barcode}
						</div>
						<div>
							<b>Залиха:</b> {qty}
						</div>
						<div>
							<b>Последна движење:</b> {lastMovement}
						</div>
					</div>

					<div className="mt-3 text-xs text-slate-500">
						Ова бришење е безбедно: производот ќе се деактивира и ќе се испразнат PLU/баркод, за да можеш после тоа да внесеш нов производ
						со истата шифра.
					</div>
				</div>

				<div className="border-t border-slate-200 px-4 py-3 flex items-center justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						disabled={isBusy}
						className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
					>
						Откажи
					</button>

					<button
						type="button"
						onClick={handleDelete}
						disabled={isBusy}
						className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
					>
						{isBusy ? 'Се брише...' : 'Да, избриши'}
					</button>
				</div>
			</div>
		</div>
	);
}
