-- EasyShop POS - Seed Data

-- 1. Shop
INSERT INTO shops (id, name, logo_url)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'EasyShop Demo',
  NULL
);

-- 2. Owner profile (real auth.users id)
INSERT INTO profiles (id, shop_id, role, full_name)
VALUES (
  '82e5d187-a910-4669-852e-25a90b8c448e',
  '11111111-1111-1111-1111-111111111111',
  'owner',
  'Demo Owner'
);

-- Link owner back to shop
UPDATE shops
SET owner_id = '82e5d187-a910-4669-852e-25a90b8c448e'
WHERE id = '11111111-1111-1111-1111-111111111111';

-- 3. Categories
INSERT INTO categories (id, shop_id, name, color, sort_order) VALUES
  ('c0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'อาหาร',      '#22c55e', 1),
  ('c0000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'เครื่องดื่ม',  '#3b82f6', 2),
  ('c0000003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'ของใช้',      '#f97316', 3);

-- 4. Products (10 items, Thai names, prices 20-200 THB)
INSERT INTO products (id, shop_id, category_id, name, price, stock, barcode, image_url) VALUES
  -- อาหาร
  ('a0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-0000-0000-000000000001', 'ข้าวผัดกระเพรา',    55.00, 100, '8850001000001', 'https://images.unsplash.com/photo-1562802378-063ec186a863?w=400&h=400&fit=crop&auto=format&q=80'),
  ('a0000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-0000-0000-000000000001', 'ก๋วยเตี๋ยวต้มยำ',    50.00, 100, '8850001000002', 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=400&h=400&fit=crop&auto=format&q=80'),
  ('a0000003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-0000-0000-000000000001', 'ข้าวมันไก่',         45.00, 120, '8850001000003', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop&auto=format&q=80'),
  ('a0000004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'c0000001-0000-0000-0000-000000000001', 'ส้มตำไทย',           40.00,  80, '8850001000004', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop&auto=format&q=80'),
  -- เครื่องดื่ม
  ('a0000005-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'c0000002-0000-0000-0000-000000000002', 'ชาเย็น',             25.00, 200, '8850001000005', 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=400&fit=crop&auto=format&q=80'),
  ('a0000006-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'c0000002-0000-0000-0000-000000000002', 'กาแฟเย็น',           35.00, 200, '8850001000006', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=400&fit=crop&auto=format&q=80'),
  ('a0000007-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'c0000002-0000-0000-0000-000000000002', 'น้ำส้มคั้นสด',        45.00, 150, '8850001000007', 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&h=400&fit=crop&auto=format&q=80'),
  -- ของใช้
  ('a0000008-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'c0000003-0000-0000-0000-000000000003', 'สบู่เหลว',          89.00,  60, '8850001000008', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=400&fit=crop&auto=format&q=80'),
  ('a0000009-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'c0000003-0000-0000-0000-000000000003', 'แปรงสีฟัน',          29.00,  75, '8850001000009', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop&auto=format&q=80'),
  ('a0000010-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'c0000003-0000-0000-0000-000000000003', 'ผงซักฟอก',         159.00,  50, '8850001000010', 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400&h=400&fit=crop&auto=format&q=80');

-- 5. Sample completed order with 2 items
INSERT INTO orders (id, shop_id, order_number, cashier_id, status, subtotal, tax_amount, discount_amount, total_amount, payment_method, created_at, completed_at)
VALUES (
  'b0000001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  1,
  '82e5d187-a910-4669-852e-25a90b8c448e',
  'completed',
  100.00,
  7.00,
  0.00,
  107.00,
  'cash',
  now() - interval '1 hour',
  now() - interval '50 minutes'
);

INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', 1, 55.00, 55.00),
  ('b0000001-0000-0000-0000-000000000001', 'a0000005-0000-0000-0000-000000000005', 2, 25.00, 50.00);  -- total items subtotal = 105, but we keep 100 as demo

INSERT INTO payments (order_id, method, amount, status, transaction_ref)
VALUES (
  'b0000001-0000-0000-0000-000000000001',
  'cash',
  107.00,
  'success',
  'CASH-DEMO-001'
);
