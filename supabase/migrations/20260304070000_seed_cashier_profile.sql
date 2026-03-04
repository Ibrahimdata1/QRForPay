INSERT INTO profiles (id, shop_id, role, full_name)
VALUES ('8aaf7842-776d-4664-862e-b5d056a9c95d', '11111111-1111-1111-1111-111111111111', 'cashier', 'Cashier 1')
ON CONFLICT (id) DO NOTHING;
