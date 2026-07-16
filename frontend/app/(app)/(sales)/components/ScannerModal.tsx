'use client';

import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { useModalKeyboard } from 'app/lib/useModalKeyboard';

type Props = {
	open: boolean;
	scanError: string | null;
	onClose: () => void;
	onScan: (detected: IDetectedBarcode[]) => void;
	onError: (err: unknown) => void;
};

export const ScannerModal = ({ open, scanError, onClose, onScan, onError }: Props) => {
	const { containerRef, initialFocusRef } = useModalKeyboard({ open, onClose });

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
			role="dialog"
			aria-modal="true"
			aria-label="Скенирај баркод / QR"
		>
			<div
				ref={containerRef}
				tabIndex={-1}
				className="w-full max-w-md rounded-2xl bg-white p-4 outline-none"
			>
				<div className="mb-2 flex items-center justify-between">
					<h2 className="text-sm font-semibold">Скенирај баркод / QR</h2>
					<button
						type="button"
						ref={(el) => {
							initialFocusRef.current = el;
						}}
						onClick={onClose}
						className="text-sm text-slate-600"
					>
						Затвори ✕ <span className="kbd ml-1">Esc</span>
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

export default ScannerModal;
