-- Migration: Set real Unsplash image URLs for demo products
-- Run this in Supabase Dashboard → SQL Editor

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1562802378-063ec186a863?w=400&h=400&fit=crop&auto=format&q=80'
WHERE id = 'a0000001-0000-0000-0000-000000000001';

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=400&h=400&fit=crop&auto=format&q=80'
WHERE id = 'a0000002-0000-0000-0000-000000000002';

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop&auto=format&q=80'
WHERE id = 'a0000003-0000-0000-0000-000000000003';

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop&auto=format&q=80'
WHERE id = 'a0000004-0000-0000-0000-000000000004';

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=400&fit=crop&auto=format&q=80'
WHERE id = 'a0000005-0000-0000-0000-000000000005';

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=400&fit=crop&auto=format&q=80'
WHERE id = 'a0000006-0000-0000-0000-000000000006';

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&h=400&fit=crop&auto=format&q=80'
WHERE id = 'a0000007-0000-0000-0000-000000000007';

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=400&fit=crop&auto=format&q=80'
WHERE id = 'a0000008-0000-0000-0000-000000000008';

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop&auto=format&q=80'
WHERE id = 'a0000009-0000-0000-0000-000000000009';

UPDATE products SET image_url = 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400&h=400&fit=crop&auto=format&q=80'
WHERE id = 'a0000010-0000-0000-0000-000000000010';
