export type ProductStockRow = {
	product_id: string;
	plu: string | null;
	barcode: string | null;
	name: string | null;
	selling_price: number | null;
	qty_on_hand: number | null;
	category_name: string | null;
	store_no?: number | null;
};

export type CartItem = {
	product: {
		id: string;
		plu: string | null;
		barcode: string | null;
		name: string;
		selling_price: number;
		category_name: string | null;
	};
	qty: number;
	finalPriceStr: string;
};

export type Totals = {
	subtotal: number;
	discountTotal: number;
	total: number;
};
