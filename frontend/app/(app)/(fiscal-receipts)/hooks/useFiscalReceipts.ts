import { useQuery } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

export type FiscalReceiptRow = {
	id: string;
	sales_receipt_id: string | null;
	receipt_type: string | null;
	fiscal_slip_no: number | null;
	fiscal_status: string | null;
	fiscal_error: string | null;
	store_no: number | null;
	payment: string | null;
	total: number;
	external_doc_no: string | null;
	created_by: string | null;
	fiscalized_at: string | null;
	created_at: string;
};

export const useFiscalReceipts = (days = 30) => {
	return useQuery({
		queryKey: ['fiscal-receipts', days],
		queryFn: () => api.get<FiscalReceiptRow[]>(`/api/fiscal-receipts?days=${days}`),
	});
};
