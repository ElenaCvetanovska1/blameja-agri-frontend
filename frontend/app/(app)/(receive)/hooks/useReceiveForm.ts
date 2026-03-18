// receive/hooks/useReceiveForm.ts
'use client';

import { useMemo, useState } from 'react';

export type Unit = 'пар' | 'кг' | 'м';
export type TaxGroup = '5' | '10' | '18';
export type StoreNo = 20 | 30;

const isValidUnit = (v: unknown): v is Unit => v === 'пар' || v === 'кг' || v === 'м';

export const useReceiveForm = () => {
	const [storeNo, setStoreNo] = useState<StoreNo>(20);

	const [categoryId, setCategoryId] = useState('');
	const [name, setName] = useState('');
	const [plu, setPlu] = useState('');
	const [barcode, setBarcode] = useState('');
	const [qty, setQty] = useState('1');
	const [unitCost, setUnitCost] = useState('');
	const [sellingPrice, setSellingPrice] = useState('');
	const [details, setDetails] = useState('');
	const [taxGroup, setTaxGroup] = useState<TaxGroup>('18');
	const [unit, setUnit] = useState<Unit>('пар');

	const isValid = useMemo(() => {
		if (!name.trim()) return false;
		if (!plu.trim()) return false;
		if (!qty.trim()) return false;
		if (!isValidUnit(unit)) return false;
		return true;
	}, [name, plu, qty, unit]);

	const reset = () => {
		setStoreNo(20);

		setCategoryId('');
		setName('');
		setPlu('');
		setBarcode('');
		setQty('1');
		setUnitCost('');
		setSellingPrice('');
		setDetails('');
		setTaxGroup('18');
		setUnit('пар');
	};

	return {
		// ✅ NEW
		storeNo,
		setStoreNo,

		categoryId,
		setCategoryId,
		name,
		setName,
		plu,
		setPlu,
		barcode,
		setBarcode,
		qty,
		setQty,
		unitCost,
		setUnitCost,
		sellingPrice,
		setSellingPrice,
		details,
		setDetails,
		taxGroup,
		setTaxGroup,
		unit,
		setUnit,

		isValid,
		reset,
	};
};