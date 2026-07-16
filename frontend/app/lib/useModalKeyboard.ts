'use client';

import { useEffect, useRef } from 'react';

type UseModalKeyboardOptions = {
	open: boolean;
	onClose: () => void;
	/** Исклучи Escape/Tab-trap додека под-дијалог (пр. скенер) е отворен. */
	enabled?: boolean;
};

const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Тастатурно однесување за модални дијалози:
 * - Escape → onClose
 * - Tab / Shift+Tab останува во дијалогот (нема keyboard trap кон позадината)
 * - При отворање фокусира initialFocusRef (или прв фокусабилен елемент)
 * - При затворање го враќа фокусот каде што беше
 *
 * `containerRef` се става на панелот од дијалогот (со tabIndex={-1}),
 * `initialFocusRef` опционално на елементот што треба прв да добие фокус.
 */
export const useModalKeyboard = ({ open, onClose, enabled = true }: UseModalKeyboardOptions) => {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const initialFocusRef = useRef<HTMLElement | null>(null);

	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	// Почетен фокус + враќање на фокусот по затворање.
	useEffect(() => {
		if (!open) return;

		const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

		const raf = requestAnimationFrame(() => {
			const container = containerRef.current;
			const target = initialFocusRef.current ?? container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? container;
			target?.focus();
		});

		return () => {
			cancelAnimationFrame(raf);
			previous?.focus();
		};
	}, [open]);

	// Escape затвора; Tab кружи внатре во дијалогот.
	useEffect(() => {
		if (!open || !enabled) return;

		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onCloseRef.current();
				return;
			}

			if (e.key !== 'Tab') return;

			const container = containerRef.current;
			if (!container) return;

			const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
				(el) => el.offsetParent !== null,
			);
			if (focusables.length === 0) return;

			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const active = document.activeElement;

			if (!(active instanceof HTMLElement) || !container.contains(active)) {
				e.preventDefault();
				first.focus();
				return;
			}
			if (!e.shiftKey && active === last) {
				e.preventDefault();
				first.focus();
			} else if (e.shiftKey && active === first) {
				e.preventDefault();
				last.focus();
			}
		};

		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [open, enabled]);

	return { containerRef, initialFocusRef };
};

export default useModalKeyboard;
