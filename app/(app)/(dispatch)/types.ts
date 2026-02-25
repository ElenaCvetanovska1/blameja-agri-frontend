// types.ts
export type Unit = 'пар' | 'кг' | 'м';

export type DispatchItem = {
  id: string;
  sifra: string;     // ќе го користиме како PLU текст
  naziv: string;
  edinMer: Unit | ''; // ако не е избрано/празно
  kolicina: number;
  cena: number;
};

export type DispatchRowVM = DispatchItem & {
  rb: number;
  iznos: number;
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
  plu: string;       // normalized
  barcode: string | null;
  name: string;      // normalized
  unit: Unit;        // normalized
  selling_price: number; // normalized
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
    iznos: number;
  }>;
  total: number;
};