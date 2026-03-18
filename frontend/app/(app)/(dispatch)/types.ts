export type Unit = 'пар' | 'кг' | 'м';

export type DispatchItem = {
	id: string;

	// must exist for DB inserts
	productId: string | null;

	sifra: string; // PLU text
	barcode: string | null;

	naziv: string;
	edinMer: Unit | '';

	kolicina: number;

	// base (fixed) from product
	cena: number;

	// sell (editable)
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
	unit: string | null; // from DB
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

		cena: number;
		prodaznaCena: number;

		iznos: number;
	}>;

	total: number;
};
