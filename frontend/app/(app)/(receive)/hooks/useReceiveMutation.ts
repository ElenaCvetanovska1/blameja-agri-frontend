// receive/hooks/useReceiveMutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';

export type Unit = 'пар' | 'кг' | 'м';
export type StoreNo = 20 | 30;

export type ReceivePayload = {
	plu: string;
	name: string;
	categoryId: string;
	qty: string;
	barcode: string;
	sellingPrice: string;
	unitCost: string;
	description: string;
	note: string;
	taxGroup: '5' | '10' | '18';
	supplierId?: string | null;

	unit: Unit | null;

	// ✅ NEW
	storeNo: StoreNo;
};

const parseNum = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const n = Number.parseFloat(trimmed.replace(',', '.'));
	if (Number.isNaN(n)) return undefined;
	return n;
};

const parsePluRequired = (raw: string) => {
	const t = raw.trim();
	if (!t) return null;
	if (!/^\d+$/.test(t)) return undefined;
	const n = Number.parseInt(t, 10);
	return Number.isFinite(n) ? n : undefined;
};

const isValidUnit = (v: unknown): v is Unit => v === 'пар' || v === 'кг' || v === 'м';
const isValidStoreNo = (v: unknown): v is StoreNo => v === 20 || v === 30;

export const useReceiveMutation = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: ReceivePayload) => {
			const pluParsed = parsePluRequired(payload.plu);
			if (pluParsed === undefined) throw new Error('PLU: невалиден број.');
			if (pluParsed === null) throw new Error('PLU е задолжителен.');
			const plu = pluParsed;

			const name = payload.name.trim();
			if (!name) throw new Error('Име на производ е задолжително.');

			const categoryIdRaw = payload.categoryId?.trim?.() ?? '';
			const categoryId: string | null = categoryIdRaw ? categoryIdRaw : null;

			const qtyNum = parseNum(payload.qty);
			if (qtyNum === undefined) throw new Error('Количина: невалиден број.');
			if (qtyNum === null || qtyNum <= 0) throw new Error('Количина мора да е > 0.');

			const barcode = payload.barcode.trim();
			const description = payload.description.trim();
			const note = payload.note.trim();

			const taxGroupNum = Number.parseInt(payload.taxGroup, 10);
			if (![5, 10, 18].includes(taxGroupNum)) throw new Error('ДДВ: невалидно.');

			const unitCostNum = parseNum(payload.unitCost);
			if (unitCostNum === undefined) throw new Error('Набавна: невалиден број.');
			const safeUnitCost = unitCostNum ?? 0;

			const sellingPriceNum = parseNum(payload.sellingPrice);
			if (sellingPriceNum === undefined) throw new Error('Продажна: невалиден број.');
			const safeSellingPrice = sellingPriceNum ?? 0;

			const supplierId = payload.supplierId ?? null;

			const unit: Unit = isValidUnit(payload.unit) ? payload.unit : 'пар';

			// ✅ storeNo (20/30)
			const storeNo: StoreNo = isValidStoreNo(payload.storeNo) ? payload.storeNo : 20;

			const { data: userData, error: userErr } = await supabase.auth.getUser();
			if (userErr) throw userErr;
			const userId = userData.user?.id ?? null;

			const orParts: string[] = [`plu.eq.${plu}`];
			if (barcode) orParts.push(`barcode.eq.${barcode}`);

			const { data: existing, error: lookupError } = await supabase
				.from('products')
				.select('id, plu, barcode, name, description, selling_price, tax_group, category_id, unit, store_no')
				.or(orParts.join(','))
				.eq('is_active', true)
				.maybeSingle();

			if (lookupError) throw lookupError;

			let productId: string;

			if (!existing) {
				const { data: inserted, error: insertError } = await supabase
					.from('products')
					.insert({
						plu,
						barcode: barcode || null,
						name,
						description: description || null,
						selling_price: safeSellingPrice,
						tax_group: taxGroupNum,
						is_active: true,
						category_id: categoryId,
						unit,
						store_no: storeNo, // ✅ NEW
					})
					.select('id')
					.single();

				if (insertError) throw insertError;
				productId = inserted.id as string;
			} else {
				productId = existing.id as string;

				const updatePayload: Record<string, unknown> = {
					category_id: categoryId,
					is_active: true,
					tax_group: taxGroupNum,
					plu,
					name,
					unit,
					store_no: storeNo, // ✅ NEW (секогаш усогласи со изборот на прием)
				};

				if (barcode) updatePayload.barcode = barcode;
				if (description) updatePayload.description = description;
				if (sellingPriceNum !== null) updatePayload.selling_price = safeSellingPrice;

				const { error: updateError } = await supabase.from('products').update(updatePayload).eq('id', productId);
				if (updateError) throw updateError;
			}

			const { data: movement, error: movementError } = await supabase
				.from('stock_movements')
				.insert({
					type: 'IN',
					note: note || 'Прием на стока',
					created_by: userId,
					supplier_id: supplierId,
				})
				.select('id')
				.single();

			if (movementError) throw movementError;

			const movementId = movement.id as string;

			const { error: itemError } = await supabase.from('stock_movement_items').insert({
				movement_id: movementId,
				product_id: productId,
				qty: qtyNum,
				unit_cost: safeUnitCost,
				unit_price: safeSellingPrice,
			});

			if (itemError) throw itemError;

			await queryClient.invalidateQueries({ queryKey: ['products'] });
			await queryClient.invalidateQueries({ queryKey: ['stock'] });
			await queryClient.invalidateQueries({ queryKey: ['product_stock'] });
			await queryClient.invalidateQueries({ queryKey: ['categories'] });
			await queryClient.invalidateQueries({ queryKey: ['product-choices'] });

			return { productId, movementId };
		},
	});
};