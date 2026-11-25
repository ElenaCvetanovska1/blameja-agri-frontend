--
-- PostgreSQL database dump
--

\restrict Ul48aQJqMsOzpxeMGs8nm2R1sHop3HwlP6TgfC3qjx2PNJG9fbluXAuNPALJMAv

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

--
-- Name: buyers_persons buyers_persons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.buyers_persons
    ADD CONSTRAINT buyers_persons_pkey PRIMARY KEY (id);


--
-- Name: cash_transactions cash_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT cash_transactions_pkey PRIMARY KEY (id);


--
-- Name: categories categories_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_code_key UNIQUE (code);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: fiscal_receipt_items fiscal_receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_receipt_items
    ADD CONSTRAINT fiscal_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: fiscal_receipts fiscal_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_receipts
    ADD CONSTRAINT fiscal_receipts_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: sales_items sales_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_items
    ADD CONSTRAINT sales_items_pkey PRIMARY KEY (id);


--
-- Name: sales_receipts sales_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_receipts
    ADD CONSTRAINT sales_receipts_pkey PRIMARY KEY (id);


--
-- Name: stock_movement_items stock_movement_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movement_items
    ADD CONSTRAINT stock_movement_items_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: buyers_persons_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX buyers_persons_created_at_idx ON public.buyers_persons USING btree (created_at DESC);


--
-- Name: buyers_persons_full_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX buyers_persons_full_name_idx ON public.buyers_persons USING btree (full_name);


--
-- Name: buyers_persons_full_name_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX buyers_persons_full_name_trgm_idx ON public.buyers_persons USING gin (full_name public.gin_trgm_ops);


--
-- Name: idx_fiscal_receipt_items_fiscal_receipt_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fiscal_receipt_items_fiscal_receipt_id ON public.fiscal_receipt_items USING btree (fiscal_receipt_id);


--
-- Name: idx_fiscal_receipt_items_original_fiscal_receipt_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fiscal_receipt_items_original_fiscal_receipt_item_id ON public.fiscal_receipt_items USING btree (original_fiscal_receipt_item_id);


--
-- Name: idx_fiscal_receipt_items_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fiscal_receipt_items_product_id ON public.fiscal_receipt_items USING btree (product_id);


--
-- Name: idx_fiscal_receipts_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fiscal_receipts_created_at ON public.fiscal_receipts USING btree (created_at DESC);


--
-- Name: idx_fiscal_receipts_fiscal_slip_no; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fiscal_receipts_fiscal_slip_no ON public.fiscal_receipts USING btree (fiscal_slip_no);


--
-- Name: idx_fiscal_receipts_fiscalized_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fiscal_receipts_fiscalized_at ON public.fiscal_receipts USING btree (fiscalized_at DESC);


--
-- Name: idx_fiscal_receipts_original_fiscal_receipt_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fiscal_receipts_original_fiscal_receipt_id ON public.fiscal_receipts USING btree (original_fiscal_receipt_id);


--
-- Name: idx_fiscal_receipts_sales_receipt_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fiscal_receipts_sales_receipt_id ON public.fiscal_receipts USING btree (sales_receipt_id);


--
-- Name: idx_products_barcode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_barcode ON public.products USING btree (barcode);


--
-- Name: idx_products_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_category_id ON public.products USING btree (category_id);


--
-- Name: idx_products_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_name ON public.products USING btree (name);


--
-- Name: idx_products_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_name_trgm ON public.products USING gin (name public.gin_trgm_ops);


--
-- Name: idx_products_plu; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_plu ON public.products USING btree (plu);


--
-- Name: idx_sales_items_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_items_product_id ON public.sales_items USING btree (product_id);


--
-- Name: idx_sales_items_receipt_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_items_receipt_id ON public.sales_items USING btree (receipt_id);


--
-- Name: idx_smi_adjust_direction; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_smi_adjust_direction ON public.stock_movement_items USING btree (adjust_direction);


--
-- Name: idx_smi_movement_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_smi_movement_id ON public.stock_movement_items USING btree (movement_id);


--
-- Name: idx_smi_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_smi_product_id ON public.stock_movement_items USING btree (product_id);


--
-- Name: products_barcode_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_barcode_idx ON public.products USING btree (barcode);


--
-- Name: products_barcode_unique_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX products_barcode_unique_active ON public.products USING btree (barcode) WHERE ((is_active = true) AND (barcode IS NOT NULL) AND (TRIM(BOTH FROM barcode) <> ''::text));


--
-- Name: products_category_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_category_id_idx ON public.products USING btree (category_id);


--
-- Name: products_category_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_category_name_idx ON public.products USING btree (category_id, lower(name));


--
-- Name: products_name_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_name_trgm_idx ON public.products USING gin (name public.gin_trgm_ops);


--
-- Name: products_plu_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX products_plu_idx ON public.products USING btree (plu);


--
-- Name: products_plu_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX products_plu_unique ON public.products USING btree (plu) WHERE (plu IS NOT NULL);


--
-- Name: products_plu_unique_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX products_plu_unique_active ON public.products USING btree (plu) WHERE ((is_active = true) AND (plu IS NOT NULL) AND (TRIM(BOTH FROM plu) <> ''::text));


--
-- Name: products_unique_name_per_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX products_unique_name_per_category ON public.products USING btree (category_id, lower(name));


--
-- Name: stock_movements_supplier_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stock_movements_supplier_id_idx ON public.stock_movements USING btree (supplier_id);


--
-- Name: suppliers_name_address_ux; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX suppliers_name_address_ux ON public.suppliers USING btree (lower(name), COALESCE(lower(address), ''::text));


--
-- Name: suppliers_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX suppliers_name_trgm ON public.suppliers USING gin (name public.gin_trgm_ops);


--
-- Name: suppliers_name_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX suppliers_name_trgm_idx ON public.suppliers USING gin (name public.gin_trgm_ops);


--
-- Name: suppliers_name_unique_ci; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX suppliers_name_unique_ci ON public.suppliers USING btree (lower(TRIM(BOTH FROM name)));


--
-- Name: suppliers_unique_name_address; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX suppliers_unique_name_address ON public.suppliers USING btree (lower(name), COALESCE(lower(address), ''::text));


--
-- Name: categories trg_categories_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: products trg_products_set_fiscal_plu; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_products_set_fiscal_plu BEFORE INSERT OR UPDATE OF category_id, fiscal_plu ON public.products FOR EACH ROW EXECUTE FUNCTION public.products_set_fiscal_plu();


--
-- Name: products trg_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: suppliers trg_suppliers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cash_transactions cash_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT cash_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: cash_transactions cash_transactions_related_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_transactions
    ADD CONSTRAINT cash_transactions_related_receipt_id_fkey FOREIGN KEY (related_receipt_id) REFERENCES public.sales_receipts(id) ON DELETE SET NULL;


--
-- Name: fiscal_receipt_items fiscal_receipt_items_fiscal_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_receipt_items
    ADD CONSTRAINT fiscal_receipt_items_fiscal_receipt_id_fkey FOREIGN KEY (fiscal_receipt_id) REFERENCES public.fiscal_receipts(id) ON DELETE CASCADE;


--
-- Name: fiscal_receipt_items fiscal_receipt_items_original_fiscal_receipt_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_receipt_items
    ADD CONSTRAINT fiscal_receipt_items_original_fiscal_receipt_item_id_fkey FOREIGN KEY (original_fiscal_receipt_item_id) REFERENCES public.fiscal_receipt_items(id) ON DELETE SET NULL;


--
-- Name: fiscal_receipt_items fiscal_receipt_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_receipt_items
    ADD CONSTRAINT fiscal_receipt_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: fiscal_receipt_items fiscal_receipt_items_sales_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_receipt_items
    ADD CONSTRAINT fiscal_receipt_items_sales_item_id_fkey FOREIGN KEY (sales_item_id) REFERENCES public.sales_items(id) ON DELETE SET NULL;


--
-- Name: fiscal_receipts fiscal_receipts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_receipts
    ADD CONSTRAINT fiscal_receipts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: fiscal_receipts fiscal_receipts_original_fiscal_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_receipts
    ADD CONSTRAINT fiscal_receipts_original_fiscal_receipt_id_fkey FOREIGN KEY (original_fiscal_receipt_id) REFERENCES public.fiscal_receipts(id) ON DELETE SET NULL;


--
-- Name: fiscal_receipts fiscal_receipts_sales_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_receipts
    ADD CONSTRAINT fiscal_receipts_sales_receipt_id_fkey FOREIGN KEY (sales_receipt_id) REFERENCES public.sales_receipts(id) ON DELETE SET NULL;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sales_items sales_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_items
    ADD CONSTRAINT sales_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: sales_items sales_items_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_items
    ADD CONSTRAINT sales_items_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.sales_receipts(id) ON DELETE CASCADE;


--
-- Name: sales_receipts sales_receipts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_receipts
    ADD CONSTRAINT sales_receipts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: stock_movement_items stock_movement_items_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movement_items
    ADD CONSTRAINT stock_movement_items_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.stock_movements(id) ON DELETE CASCADE;


--
-- Name: stock_movement_items stock_movement_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movement_items
    ADD CONSTRAINT stock_movement_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: cash_transactions auth_all_cash_transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_cash_transactions ON public.cash_transactions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: categories auth_all_categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_categories ON public.categories TO authenticated USING (true) WITH CHECK (true);


--
-- Name: products auth_all_products; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_products ON public.products TO authenticated USING (true) WITH CHECK (true);


--
-- Name: profiles auth_all_profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_profiles ON public.profiles TO authenticated USING (true) WITH CHECK (true);


--
-- Name: sales_items auth_all_sales_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_sales_items ON public.sales_items TO authenticated USING (true) WITH CHECK (true);


--
-- Name: sales_receipts auth_all_sales_receipts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_sales_receipts ON public.sales_receipts TO authenticated USING (true) WITH CHECK (true);


--
-- Name: stock_movement_items auth_all_stock_movement_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_stock_movement_items ON public.stock_movement_items TO authenticated USING (true) WITH CHECK (true);


--
-- Name: stock_movements auth_all_stock_movements; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_stock_movements ON public.stock_movements TO authenticated USING (true) WITH CHECK (true);


--
-- Name: buyers_persons; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.buyers_persons ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_transactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_receipt_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_receipt_items ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_receipts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sales_items ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_receipts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sales_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movement_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_movement_items ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers suppliers_insert_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY suppliers_insert_auth ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: suppliers suppliers_select_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY suppliers_select_auth ON public.suppliers FOR SELECT TO authenticated USING (true);


--
-- PostgreSQL database dump complete
--

\unrestrict Ul48aQJqMsOzpxeMGs8nm2R1sHop3HwlP6TgfC3qjx2PNJG9fbluXAuNPALJMAv

