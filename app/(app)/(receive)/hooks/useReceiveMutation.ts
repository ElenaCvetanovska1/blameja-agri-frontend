import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';

type ReceivePayload = {
	sku: string;
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
};

const parseNum = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const num = Number.parseFloat(trimmed.replace(',', '.'));
	if (Number.isNaN(num)) return undefined;
	return num;
};

export const useReceiveMutation = (payload: ReceivePayload) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			const sku = payload.sku.trim();
			const barcode = payload.barcode.trim();

			const name = payload.name.trim(); // optional
			const description = payload.description.trim(); // optional
			const unitInput = payload.unit.trim(); // optional
			const unit = unitInput || 'pcs';

			const note = payload.note.trim(); // optional

			const categoryId = payload.categoryId.trim();
			const subcategoryId = payload.subcategoryId.trim();

			// ✅ REQUIRED ONLY:
			if (!sku && !barcode) throw new Error('Внеси SKU или баркод (барем едно).');
			if (!categoryId) throw new Error('Избери категорија.');
			if (!subcategoryId) throw new Error('Избери подкатегорија.');

			const qtyNum = parseNum(payload.qty);
			if (qtyNum === undefined) throw new Error('Количина: невалиден број.');
			if (qtyNum === null || qtyNum <= 0) throw new Error('Количина мора да е > 0.');

			const unitCostNum = parseNum(payload.unitCost);
			if (unitCostNum === undefined) throw new Error('Набавна: невалиден број.');
			const safeUnitCost = unitCostNum ?? 0; // за stock_movement_items може 0

			const sellingPriceNum = parseNum(payload.sellingPrice);
			if (sellingPriceNum === undefined) throw new Error('Продажна: невалиден број.');
			const safeSellingPrice = sellingPriceNum ?? 0;

			const { data: userData } = await supabase.auth.getUser();
			const userId = userData.user?.id ?? null;

			const lookupKey = sku || barcode;

			// земи и existing вредности за да не ги бришеме ако се оставени празни
			const { data: existing, error: lookupError } = await supabase
				.from('products')
				.select('id, sku, barcode, name, description, selling_price, unit')
				.or(`sku.eq.${lookupKey},barcode.eq.${lookupKey}`)
				.maybeSingle();

			if (lookupError) throw lookupError;

			let productId: string;

			if (!existing) {
				// INSERT: name мора да постои во DB (ако ти е NOT NULL),
				// па ако е празно во UI, ставаме fallback
				const safeName = name || sku || barcode || 'Производ';

				const { data: inserted, error: insertError } = await supabase
					.from('products')
					.insert({
						sku: sku || null,
						barcode: barcode || null,
						name: safeName,
						description: description || null,
						unit,
						selling_price: safeSellingPrice, // ако празно -> 0
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

				// UPDATE: НЕ бришеме постоечки полиња ако во UI се празни
				const updatePayload: Record<string, unknown> = {
					category_id: categoryId,
					subcategory_id: subcategoryId,
					is_active: true,
				};

				// sku/barcode: ако се внесени -> update, ако празни -> не чепкаме
				if (sku) updatePayload.sku = sku;
				if (barcode) updatePayload.barcode = barcode;

				// name/description: ако се внесени -> update, ако празни -> не чепкаме
				if (name) updatePayload.name = name;
				if (description) updatePayload.description = description;

				// unit: ако е внесено нешто -> update (инаку остави го)
				if (unitInput) updatePayload.unit = unit;

				// selling_price: ако user внел број -> update, ако празно -> не чепкаме
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
				unit_price: safeSellingPrice, // ако не внел продажна -> 0 (историски)
			});

			if (itemError) throw itemError;

			await queryClient.invalidateQueries({ queryKey: ['products'] });
			await queryClient.invalidateQueries({ queryKey: ['stock'] });

			return { productId, movementId };
		},
	});
};
