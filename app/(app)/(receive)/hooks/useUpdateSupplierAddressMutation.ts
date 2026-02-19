import { useMutation } from '@tanstack/react-query';
import { supabase } from 'app/lib/supabase-client';

type Payload = {
	supplierId: string;
	address: string;
};

const updateSupplierAddress = async ({ supplierId, address }: Payload) => {
	const trimmed = address.trim();
	if (!trimmed) return;

	// ✅ препорачано преку RPC (за RLS контрола)
	const { error } = await supabase.rpc('supplier_update_address', {
		_supplier_id: supplierId,
		_address: trimmed,
	});

	if (error) throw error;
};

export const useUpdateSupplierAddressMutation = () => {
	return useMutation({
		mutationFn: updateSupplierAddress,
	});
};
