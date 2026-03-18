import { useMutation } from '@tanstack/react-query';
import { api } from 'app/lib/api-client';

type Payload = {
	supplierId: string;
	address: string;
};

const updateSupplierAddress = async ({ supplierId, address }: Payload) => {
	const trimmed = address.trim();
	if (!trimmed) return;

	await api.patch(`/api/suppliers/${supplierId}/address`, { address: trimmed });
};

export const useUpdateSupplierAddressMutation = () => {
	return useMutation({
		mutationFn: updateSupplierAddress,
	});
};
