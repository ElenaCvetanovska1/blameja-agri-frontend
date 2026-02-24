'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { CartItem, ProductStockRow, Totals } from '../types';
import {
	num,
	priceNum,
	round2,
	safeText,
	clampPrice,
	sanitizePriceInput,
	clampFinalToBase,
	discountPerUnitFromBaseFinal,
} from '../utils';

export const useCart = () => {
	const [cart, setCart] = useState<CartItem[]>([]);

	const totals: Totals = useMemo(() => {
		const subtotal = cart.reduce((sum, item) => {
			const base = num(item.product.selling_price);
			return sum + item.qty * base;
		}, 0);

		const discountTotal = cart.reduce((sum, item) => {
			const base = num(item.product.selling_price);
			const finalRaw = priceNum(item.finalPriceStr);
			const final = clampFinalToBase(finalRaw, base);
			const discPerUnit = discountPerUnitFromBaseFinal(base, final);
			return sum + item.qty * discPerUnit;
		}, 0);

		return {
			subtotal: round2(subtotal),
			discountTotal: round2(discountTotal),
			total: round2(subtotal - discountTotal),
		};
	}, [cart]);

	const resetCart = () => setCart([]);

	const updateItem = (productId: string, patch: Partial<CartItem>) => {
		setCart((prev) => prev.map((i) => (i.product.id === productId ? { ...i, ...patch } : i)));
	};

	const removeItem = (productId: string) => {
		setCart((prev) => prev.filter((i) => i.product.id !== productId));
	};

	const changeQty = (productId: string, nextQty: number) => {
		updateItem(productId, { qty: Math.max(1, Math.floor(nextQty || 1)) });
	};

	const patchFinalPrice = (productId: string, raw: string) => {
		updateItem(productId, { finalPriceStr: sanitizePriceInput(raw) });
	};

	const clampFinalPriceOnBlur = (productId: string) => {
		const item = cart.find((c) => c.product.id === productId);
		if (!item) return;

		const base = num(item.product.selling_price);
		const finalRaw = priceNum(item.finalPriceStr);
		const final = clampFinalToBase(finalRaw, base);

		updateItem(productId, { finalPriceStr: clampPrice(String(final)) });
	};

	/**
	 * ✅ IMPORTANT CHANGE:
	 * - НЕ блокира ако нема залиха (дозволува да оди во минус)
	 * - Само пушта warning ако веќе си над залиха
	 */
	const addToCartFromRow = async (row: ProductStockRow): Promise<string | null> => {
		const productId = row.product_id;
		const available = num(row.qty_on_hand);
		const inCart = cart.find((c) => c.product.id === productId)?.qty ?? 0;

		// ✅ Allow adding even if available is 0 or less than cart
		if (available <= inCart) {
			toast.warning(
				`Внимание: залиха ${available}, во кошничка ${inCart}. Продажбата ќе оди во минус.`
			);
		}

		const product = {
			id: productId,
			plu: row.plu ?? null,
			barcode: row.barcode ?? null,
			name: safeText(row.name) || '—',
			selling_price: num(row.selling_price),
			category_name: row.category_name ?? null,
		};

		setCart((prev) => {
			const idx = prev.findIndex((p) => p.product.id === productId);

			// NEW item -> put on top
			if (idx === -1) {
				const base = round2(num(product.selling_price));
				const newItem: CartItem = {
					product,
					qty: 1,
					finalPriceStr: base > 0 ? String(base) : '',
				};
				return [newItem, ...prev];
			}

			// EXISTING item -> +1 qty and move to top
			const updated: CartItem = { ...prev[idx], qty: prev[idx].qty + 1 };
			return [updated, ...prev.filter((_, i) => i !== idx)];
		});

		toast.success(`Додадено: ${product.name}`);
		return productId;
	};

	return {
		cart,
		totals,
		resetCart,
		removeItem,
		changeQty,
		addToCartFromRow,
		patchFinalPrice,
		clampFinalPriceOnBlur,
	};
};