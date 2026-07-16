'use client';

import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { useModalKeyboard } from 'app/lib/useModalKeyboard';

type Props = {
	open: boolean;
	onClose: () => void;
	onScan: (raw: string) => void;
	errorText: string | null;
	setErrorText: (v: string | null) => void;
};

export const ScannerModal = ({ open, onClose, onScan, errorText, setErrorText }: Props) => {
	const { containerRef, initialFocusRef } = useModalKeyboard({ open, onClose });

	if (!open) return null;

	const handleScan = (detected: IDetectedBarcode[]) => {
		const raw = detected?.[0]?.rawValue ?? '';
		if (!raw) return;
		setErrorText(null);
		onScan(raw);
		onClose();
	};

	const handleError = (err: unknown) => {
		console.error('Scanner error:', err);
		setErrorText('Настана грешка при пристап до камерата.');
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
			role="dialog"
			aria-modal="true"
			aria-label="Скенирај баркод"
		>
			<div
				ref={containerRef}
				tabIndex={-1}
				className="w-full max-w-md rounded-2xl bg-white p-4 outline-none"
			>
				<div className="mb-2 flex items-center justify-between">
					<h2 className="text-sm font-semibold">Скенирај баркод</h2>
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

				<div className="overflow-hidden rounded-xl border border-slate-200">
					<Scanner
						onScan={handleScan}
						onError={handleError}
						constraints={{ facingMode: 'environment' }}
					/>
				</div>

				{errorText && <p className="mt-2 text-xs text-blamejaRed">{errorText}</p>}
			</div>
		</div>
	);
};
