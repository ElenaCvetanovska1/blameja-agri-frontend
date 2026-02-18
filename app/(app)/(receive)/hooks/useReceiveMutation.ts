import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';

type ReceivePayload = {
	plu: string;
	barcode: string;
	name: string;
	description: string;
	unit: string;
	sellingPrice: string;
	qty: string;
	unitCost: string;
	note: string;
	categoryId: string;
	subcategoryId: string;
	taxGroup: '5' | '10' | '18';
};

const parseNum = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const num = Number.parseFloat(trimmed.replace(',', '.'));
	if (Number.isNaN(num)) return undefined;
	return num;
};

const parsePlu = (raw: string) => {
	const t = raw.trim();
	if (!t) return null;
	if (!/^\d+$/.test(t)) return undefined; // внесено нешто што не е број => ERROR
	const n = Number.parseInt(t, 10);
	return Number.isFinite(n) ? n : undefined;
};

export const useReceiveMutation = (payload: ReceivePayload) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			const pluParsed = parsePlu(payload.plu);
			if (pluParsed === undefined) throw new Error('PLU: невалиден број.');

			const plu = pluParsed; // number | null
			const barcode = payload.barcode.trim();

			const name = payload.name.trim(); // optional
			const description = payload.description.trim(); // optional
			const unitInput = payload.unit.trim(); // optional
			const unit = unitInput || 'pcs';

			const note = payload.note.trim(); // optional
			const categoryId = payload.categoryId.trim();
			const subcategoryId = payload.subcategoryId.trim();

			const taxGroupNum = Number.parseInt(payload.taxGroup, 10);
			if (![5, 10, 18].includes(taxGroupNum)) throw new Error('ДДВ: невалидно.');

			// ✅ REQUIRED ONLY:
			if (plu === null && !barcode) throw new Error('Внеси PLU или баркод (барем едно).');
			if (!categoryId) throw new Error('Избери категорија.');
			if (!subcategoryId) throw new Error('Избери подкатегорија.');

			const qtyNum = parseNum(payload.qty);
			if (qtyNum === undefined) throw new Error('Количина: невалиден број.');
			if (qtyNum === null || qtyNum <= 0) throw new Error('Количина мора да е > 0.');

			const unitCostNum = parseNum(payload.unitCost);
			if (unitCostNum === undefined) throw new Error('Набавна: невалиден број.');
			const safeUnitCost = unitCostNum ?? 0;

			const sellingPriceNum = parseNum(payload.sellingPrice);
			if (sellingPriceNum === undefined) throw new Error('Продажна: невалиден број.');
			const safeSellingPrice = sellingPriceNum ?? 0;

			const { data: userData } = await supabase.auth.getUser();
			const userId = userData.user?.id ?? null;

			// lookup existing product by (plu OR barcode)
			const orParts: string[] = [];
			if (barcode) orParts.push(`barcode.eq.${barcode}`);
			if (plu !== null) orParts.push(`plu.eq.${plu}`);
			const orFilter = orParts.join(',');

			const { data: existing, error: lookupError } = await supabase
				.from('products')
				.select('id, plu, barcode, name, description, selling_price, unit, tax_group')
				.or(orFilter)
				.maybeSingle();

			if (lookupError) throw lookupError;

			let productId: string;

			if (!existing) {
				const safeName = name || (plu !== null ? `PLU ${plu}` : barcode) || 'Производ';

				const { data: inserted, error: insertError } = await supabase
					.from('products')
					.insert({
						plu: plu ?? null,
						barcode: barcode || null,
						name: safeName,
						description: description || null,
						unit,
						selling_price: safeSellingPrice,
						tax_group: taxGroupNum,
						is_active: true,
						category_id: categoryId,
						subcategory_id: subcategoryId,
					})
					.select('id')
					.single();

				if (insertError) throw insertError;
				productId = inserted.id as string;
			} else {
				productId = existing.id as string;

				const updatePayload: Record<string, unknown> = {
					category_id: categoryId,
					subcategory_id: subcategoryId,
					is_active: true,
					tax_group: taxGroupNum,
				};

				// ако е внесен PLU -> update
				if (plu !== null) updatePayload.plu = plu;

				// ако е внесен barcode -> update
				if (barcode) updatePayload.barcode = barcode;

				if (name) updatePayload.name = name;
				if (description) updatePayload.description = description;
				if (unitInput) updatePayload.unit = unit;

				// selling_price: ако е внесен број -> update, ако празно -> не чепкаме
				if (sellingPriceNum !== null) updatePayload.selling_price = safeSellingPrice;

				const { error: updateError } = await supabase.from('products').update(updatePayload).eq('id', productId);
				if (updateError) throw updateError;
			}

			// stock movement (IN)
			const { data: movement, error: movementError } = await supabase
				.from('stock_movements')
				.insert({
					type: 'IN',
					note: note || 'Прием на стока',
					created_by: userId,
				})
				.select('id')
				.single();

			if (movementError) throw movementError;

			const movementId = movement.id as string;

			// movement item
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
			await queryClient.invalidateQueries({ queryKey: ['categoryTree'] });

			return { productId, movementId };
		},
	});
};
