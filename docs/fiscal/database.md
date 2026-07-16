-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'seller'::text CHECK (role = ANY (ARRAY['admin'::text, 'seller'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  barcode text,
  name text NOT NULL,
  description text,
  selling_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  category_id uuid,
  plu text,
  tax_group smallint CHECK ((tax_group = ANY (ARRAY[5, 10, 18])) OR tax_group IS NULL),
  fiscal_plu integer,
  unit text NOT NULL DEFAULT 'пар'::text CHECK (unit = ANY (ARRAY['пар'::text, 'кг'::text, 'м'::text])),
  store_no integer CHECK (store_no = ANY (ARRAY[20, 30])),
  is_macedonian boolean NOT NULL DEFAULT false,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  movement_no bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  type USER-DEFINED NOT NULL,
  note text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  supplier_id uuid,
  store_no integer CHECK (store_no = ANY (ARRAY[20, 30])),
  CONSTRAINT stock_movements_pkey PRIMARY KEY (id),
  CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT stock_movements_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id)
);
CREATE TABLE public.stock_movement_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  movement_id uuid NOT NULL,
  product_id uuid NOT NULL,
  qty numeric NOT NULL CHECK (qty > 0::numeric),
  unit_cost numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  adjust_direction USER-DEFINED NOT NULL DEFAULT 'PLUS'::adjust_direction,
  CONSTRAINT stock_movement_items_pkey PRIMARY KEY (id),
  CONSTRAINT stock_movement_items_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.stock_movements(id),
  CONSTRAINT stock_movement_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.sales_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  receipt_no bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  payment USER-DEFINED DEFAULT 'CASH'::payment_method,
  total numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cash_received numeric CHECK (cash_received IS NULL OR cash_received >= 0::numeric),
  doc_type text NOT NULL DEFAULT 'POS'::text CHECK (doc_type = ANY (ARRAY['POS'::text, 'DISPATCH'::text])),
  external_doc_no text,
  store_no integer CHECK (store_no = ANY (ARRAY[20, 30])),
  fiscal_slip_no integer,
  fiscal_status text,
  fiscal_synced_at timestamp with time zone,
  fiscal_error text,
  CONSTRAINT sales_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT sales_receipts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.sales_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL,
  product_id uuid NOT NULL,
  qty numeric NOT NULL CHECK (qty > 0::numeric),
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0::numeric),
  discount numeric NOT NULL DEFAULT 0 CHECK (discount >= 0::numeric),
  base_price numeric CHECK (base_price >= 0::numeric),
  CONSTRAINT sales_items_pkey PRIMARY KEY (id),
  CONSTRAINT sales_items_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.sales_receipts(id),
  CONSTRAINT sales_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.cash_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type USER-DEFINED NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  note text,
  related_receipt_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cash_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT cash_transactions_related_receipt_id_fkey FOREIGN KEY (related_receipt_id) REFERENCES public.sales_receipts(id),
  CONSTRAINT cash_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.buyers_persons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (TRIM(BOTH FROM full_name) <> ''::text),
  address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT buyers_persons_pkey PRIMARY KEY (id)
);
CREATE TABLE public.fiscal_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sales_receipt_id uuid,
  receipt_type text NOT NULL DEFAULT 'sale'::text CHECK (receipt_type = ANY (ARRAY['sale'::text, 'storno'::text, 'refund'::text])),
  fiscal_slip_no integer,
  fiscal_status text NOT NULL CHECK (fiscal_status = ANY (ARRAY['success'::text, 'failed'::text, 'partial'::text, 'pending'::text])),
  fiscal_error text,
  store_no integer,
  payment USER-DEFINED,
  total numeric NOT NULL DEFAULT 0,
  cash_received numeric,
  paid_amount numeric,
  change_amount numeric,
  subtotal numeric,
  external_doc_no text,
  created_by uuid,
  fiscalized_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  bridge_response jsonb,
  original_fiscal_receipt_id uuid,
  CONSTRAINT fiscal_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT fiscal_receipts_sales_receipt_id_fkey FOREIGN KEY (sales_receipt_id) REFERENCES public.sales_receipts(id),
  CONSTRAINT fiscal_receipts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT fiscal_receipts_original_fiscal_receipt_id_fkey FOREIGN KEY (original_fiscal_receipt_id) REFERENCES public.fiscal_receipts(id)
);
CREATE TABLE public.fiscal_receipt_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  fiscal_receipt_id uuid NOT NULL,
  sales_item_id uuid,
  product_id uuid,
  plu text,
  fiscal_plu integer,
  product_name text NOT NULL,
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  line_total numeric NOT NULL,
  discount numeric DEFAULT 0,
  base_price numeric,
  tax_group smallint NOT NULL CHECK (tax_group = ANY (ARRAY[1, 2, 3, 4])),
  tax_percent numeric,
  is_macedonian boolean NOT NULL DEFAULT false,
  unit text,
  barcode text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  original_fiscal_receipt_item_id uuid,
  CONSTRAINT fiscal_receipt_items_pkey PRIMARY KEY (id),
  CONSTRAINT fiscal_receipt_items_fiscal_receipt_id_fkey FOREIGN KEY (fiscal_receipt_id) REFERENCES public.fiscal_receipts(id),
  CONSTRAINT fiscal_receipt_items_sales_item_id_fkey FOREIGN KEY (sales_item_id) REFERENCES public.sales_items(id),
  CONSTRAINT fiscal_receipt_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT fiscal_receipt_items_original_fiscal_receipt_item_id_fkey FOREIGN KEY (original_fiscal_receipt_item_id) REFERENCES public.fiscal_receipt_items(id)
);