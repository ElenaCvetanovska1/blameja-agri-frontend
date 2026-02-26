// receive/types.ts
export type CategoryRow = { id: string; name: string; code: string };

export type Unit = 'пар' | 'кг' | 'м';
export type TaxGroup = '5' | '10' | '18';
export type StoreNo = 20 | 30;

export type ProductChoiceRow = {
	product_id: string;
	name: string | null;
	plu: string | null;
	barcode: string | null;
	selling_price: number | null;
	tax_group: number | null;
	category_id: string | null;
	category_name?: string | null;
	unit?: Unit | null;

	store_no?: StoreNo | null;
};