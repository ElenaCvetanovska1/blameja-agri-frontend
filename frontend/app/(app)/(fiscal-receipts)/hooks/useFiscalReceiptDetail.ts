import { useQuery } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

export type FiscalReceiptDetail = {
	id: string;
	sales_receipt_id: string | null;
	receipt_type: string | null;
	fiscal_slip_no: number | null;
	fiscal_status: string | null;
	fiscal_error: string | null;
	store_no: number | null;
	payment: string | null;
	total: number;
	cash_received: number | null;
	paid_amount: number | null;
	change_amount: number | null;
	subtotal: number | null;
	external_doc_no: string | null;
	created_by: string | null;
	bridge_response: string | null;
	fiscalized_at: string | null;
	created_at: string;
	original_fiscal_receipt_id: string | null;
};

export type FiscalReceiptItem = {
	id: string;
	fiscal_receipt_id: string;
	sales_item_id: string | null;
	product_id: string | null;
	plu: string | null;
	fiscal_plu: number | null;
	product_name: string | null;
	quantity: number;
	unit_price: number;
	line_total: number;
	discount: number;
	base_price: number;
	tax_group: number | null;
	tax_percent: number | null;
	is_macedonian: boolean;
	unit: string | null;
	barcode: string | null;
	created_at: string;
	original_fiscal_receipt_item_id: string | null;
	/** Remaining returnable quantity (original qty minus already-storno'd). */
	remaining_qty: number;
};

export type FiscalReceiptDetailResponse = {
	receipt: FiscalReceiptDetail;
	items: FiscalReceiptItem[];
};

export const useFiscalReceiptDetail = (id: string | undefined) => {
	return useQuery({
		queryKey: ['fiscal-receipt', id],
		queryFn: () => api.get<FiscalReceiptDetailResponse>(`/api/fiscal-receipts/${id}`),
		enabled: !!id,
	});
};
