-- Move cashier to shop 1 (was wrongly assigned to shop 2)
UPDATE profiles
SET shop_id = '11111111-1111-1111-1111-111111111111'
WHERE id = '0b322b97-4a46-4717-9b1b-aba79c745410';

-- Remove shop 2 (was created by mistake)
DELETE FROM shops WHERE id = '22222222-2222-2222-2222-222222222222';
