'use client';

import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';

type Props = {
	open: boolean;
	scanError: string | null;
	onClose: () => void;
	onScan: (detected: IDetectedBarcode[]) => void;
	onError: (err: unknown) => void;
};

export const ScannerModal = ({ open, scanError, onClose, onScan, onError }: Props) => {
	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
			<div className="w-full max-w-md rounded-2xl bg-white p-4">
				<div className="mb-2 flex items-center justify-between">
					<h2 className="text-sm font-semibold">Скенирај баркод / QR</h2>
					<button
						type="button"
						onClick={onClose}
						className="text-sm text-slate-600"
					>
						Затвори ✕
					</button>
				</div>

				<p className="mb-2 text-xs text-slate-500">Насочи ја камерата кон етикетата. По читање, производот ќе се додаде во кошничка.</p>

				<div className="overflow-hidden rounded-xl border border-slate-200">
					<Scanner
						onScan={onScan}
						onError={onError}
						constraints={{ facingMode: 'environment' }}
					/>
				</div>

				{scanError && <p className="mt-2 text-xs text-blamejaRed">{scanError}</p>}
			</div>
		</div>
	);
};
