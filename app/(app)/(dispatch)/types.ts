// types.ts
export type Unit = 'пар' | 'кг' | 'м';

export type DispatchItem = {
	id: string;
	sifra: string; // PLU текст
	naziv: string;
	edinMer: Unit | '';
	kolicina: number;

	// ✅ фиксна цена (од производ)
	cena: number;

	// ✅ продажна цена (ја внесуваш ти)
	prodaznaCena: number;
};

export type DispatchRowVM = DispatchItem & {
	rb: number;
	iznos: number; // kolicina * prodaznaCena
};

export type ProductLookupRow = {
	id: string;
	plu: string | null;
	barcode: string | null;
	name: string | null;
	unit: string | null;
	selling_price: number | null;
};

export type ProductSuggestion = {
	id: string;
	plu: string;
	barcode: string | null;
	name: string;
	unit: Unit;
	selling_price: number;
};

export type BuyerRow = {
	key: string;
	name: string;
	address: string | null;
	source: 'PERSON' | 'SUPPLIER';
};

export type DocData = {
	docNo: string;
	docDate: string;

	logoDataUrl?: string;
	firmaNaziv: string;
	firmaAdresa: string;
	firmaTelefon: string;
	firmaTransSmetka: string;

	kupuvac: string;
	adresa: string;

	items: Array<{
		rb: number;
		sifra: string;
		naziv: string;
		edinMer: string;
		kolicina: number;

		cena: number; // фиксна
		prodaznaCena: number; // продажна

		iznos: number; // kolicina * prodaznaCena
	}>;

	total: number;
};
