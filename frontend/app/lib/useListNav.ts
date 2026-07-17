'use client';

import { useEffect, useRef, useState } from 'react';

type UseListNavOptions = {
	/** Број на прикажани ставки во листата. */
	itemCount: number;
	/** Дали листата е отворена. */
	isOpen: boolean;
	/** Избор на ставка (Enter врз обележана ставка). */
	onPick: (index: number) => void;
	/** Затворање на листата (Escape). */
	onClose: () => void;
	/** ArrowDown кога листата е затворена — отвори ја (опц.). */
	onOpen?: () => void;
	/** Enter кога ништо не е обележано (пр. точен barcode lookup). */
	onEnterNoSelection?: () => void;
	/** Escape кога листата е веќе затворена (пр. чисти внес). */
	onEscapeClosed?: () => void;
	/** Кога се менува (обично вредноста на инпутот) — ресетирај го обележувањето. */
	resetKey?: unknown;
	/**
	 * Дали резултатите сè уште се вчитуваат/чекаат (debounce/fetch).
	 * Додека е `true`, првиот НЕ се обележува автоматски — така „шифра + брз Enter"
	 * оди на точниот lookup (onEnterNoSelection), а не на застарен предлог.
	 */
	loading?: boolean;
};

/**
 * Тастатурна навигација за autocomplete/dropdown листи (combobox шема):
 * - ArrowDown / ArrowUp — движење низ ставките (кружно)
 * - Enter — избери обележана ставка (или onEnterNoSelection ако нема)
 * - Escape — затвори листа (или onEscapeClosed ако е веќе затворена)
 *
 * Ставките во листата треба да имаат `data-nav-index={i}` и `tabIndex={-1}`,
 * а скрол-контејнерот `ref={listRef}` за автоматско scroll-into-view.
 */
export const useListNav = ({
	itemCount,
	isOpen,
	onPick,
	onClose,
	onOpen,
	onEnterNoSelection,
	onEscapeClosed,
	resetKey,
	loading = false,
}: UseListNavOptions) => {
	const [activeIndex, setActiveIndex] = useState(-1);
	const listRef = useRef<HTMLDivElement | null>(null);

	// Ресетирај обележување при затворање или нов внес.
	useEffect(() => {
		if (!isOpen) setActiveIndex(-1);
	}, [isOpen]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: resetKey е наменски единствена зависност
	useEffect(() => {
		setActiveIndex(-1);
	}, [resetKey]);

	// Авто-обележи го ПРВИОТ штом резултатите се спремни (не додека се вчитува).
	// Не ја прегазува рачната стрелка-селекција — само поместува од „ништо" на „прв".
	useEffect(() => {
		if (!isOpen || loading || itemCount <= 0) return;
		setActiveIndex((i) => (i < 0 ? 0 : Math.min(i, itemCount - 1)));
	}, [isOpen, loading, itemCount]);

	// Обележаната ставка секогаш видлива во скролот.
	useEffect(() => {
		if (activeIndex < 0) return;
		const el = listRef.current?.querySelector(`[data-nav-index="${activeIndex}"]`);
		if (el instanceof HTMLElement) el.scrollIntoView({ block: 'nearest' });
	}, [activeIndex]);

	const onInputKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'ArrowDown') {
			if (!isOpen) {
				if (onOpen) {
					e.preventDefault();
					onOpen();
				}
				return;
			}
			if (itemCount > 0) {
				e.preventDefault();
				setActiveIndex((i) => (i + 1) % itemCount);
			}
			return;
		}

		if (e.key === 'ArrowUp') {
			if (isOpen && itemCount > 0) {
				e.preventDefault();
				setActiveIndex((i) => (i <= 0 ? itemCount - 1 : i - 1));
			}
			return;
		}

		if (e.key === 'Enter') {
			if (isOpen && activeIndex >= 0 && activeIndex < itemCount) {
				e.preventDefault();
				onPick(activeIndex);
			} else if (onEnterNoSelection) {
				e.preventDefault();
				onEnterNoSelection();
			}
			return;
		}

		if (e.key === 'Escape') {
			if (isOpen) {
				e.preventDefault();
				onClose();
			} else {
				onEscapeClosed?.();
			}
		}
	};

	return { activeIndex, setActiveIndex, listRef, onInputKeyDown };
};

export default useListNav;
