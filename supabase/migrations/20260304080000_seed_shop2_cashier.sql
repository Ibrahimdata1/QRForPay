-- Second shop
INSERT INTO shops (id, name, logo_url)
VALUES ('22222222-2222-2222-2222-222222222222', 'EasyShop Demo 2', NULL)
ON CONFLICT (id) DO NOTHING;

-- Cashier of shop 2
INSERT INTO profiles (id, shop_id, role, full_name)
VALUES ('0b322b97-4a46-4717-9b1b-aba79c745410', '22222222-2222-2222-2222-222222222222', 'cashier', 'Cashier 2')
ON CONFLICT (id) DO NOTHING;
