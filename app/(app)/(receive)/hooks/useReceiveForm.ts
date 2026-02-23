'use client';

import { useMemo, useState } from 'react';

export type Unit = 'пар' | 'кг' | 'м';
export type TaxGroup = '5' | '10' | '18';

const isValidUnit = (v: unknown): v is Unit => v === 'пар' || v === 'кг' || v === 'м';

export const useReceiveForm = () => {
	const [categoryId, setCategoryId] = useState('');
	const [name, setName] = useState('');
	const [plu, setPlu] = useState('');
	const [barcode, setBarcode] = useState('');
	const [qty, setQty] = useState('1');
	const [unitCost, setUnitCost] = useState('');
	const [sellingPrice, setSellingPrice] = useState('');
	const [details, setDetails] = useState('');
	const [taxGroup, setTaxGroup] = useState<TaxGroup>('18');

	// ✅ NEW: unit (ед. мерка) default = 'пар'
	const [unit, setUnit] = useState<Unit>('пар');

	const isValid = useMemo(() => {
		if (!name.trim()) return false;
		if (!categoryId.trim()) return false;
		if (!plu.trim()) return false;
		if (!qty.trim()) return false;

		// unit is always valid because it's a select, but keep it strict
		if (!isValidUnit(unit)) return false;

		return true;
	}, [name, categoryId, plu, qty, unit]);

	const reset = () => {
		setCategoryId('');
		setName('');
		setPlu('');
		setBarcode('');
		setQty('1');
		setUnitCost('');
		setSellingPrice('');
		setDetails('');
		setTaxGroup('18');

		// ✅ reset unit to default
		setUnit('пар');
	};

	return {
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

		// ✅ expose unit + setter
		unit,
		setUnit,

		isValid,
		reset,
	};
};
