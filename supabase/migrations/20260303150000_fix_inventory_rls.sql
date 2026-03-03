-- Fix inventory RLS to separate read/write by role (M-4)
-- The original "shop_ingredients" and "shop_stock_transactions" policies used FOR ALL,
-- which allowed cashiers to insert/update/delete ingredients — only owners should be able to.

DROP POLICY IF EXISTS "shop_ingredients" ON ingredients;
CREATE POLICY "ingredients_select" ON ingredients FOR SELECT USING (shop_id = get_my_shop_id());
CREATE POLICY "ingredients_write" ON ingredients FOR INSERT WITH CHECK (shop_id = get_my_shop_id() AND get_my_role() = 'owner');
CREATE POLICY "ingredients_update" ON ingredients FOR UPDATE USING (shop_id = get_my_shop_id() AND get_my_role() = 'owner');
CREATE POLICY "ingredients_delete" ON ingredients FOR DELETE USING (shop_id = get_my_shop_id() AND get_my_role() = 'owner');

DROP POLICY IF EXISTS "shop_stock_transactions" ON stock_transactions;
CREATE POLICY "stock_tx_select" ON stock_transactions FOR SELECT USING (shop_id = get_my_shop_id());
CREATE POLICY "stock_tx_insert" ON stock_transactions FOR INSERT WITH CHECK (shop_id = get_my_shop_id());
