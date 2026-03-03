-- Fix storage policies to restrict uploads to own shop path (H-3)
-- Original policies allowed any authenticated user to upload/update/delete
-- any file in the product-images bucket regardless of shop ownership.
-- These new policies enforce that the first folder segment must match the caller's shop_id.

DROP POLICY IF EXISTS "Authenticated upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete product images" ON storage.objects;

CREATE POLICY "Upload to own shop path" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = get_my_shop_id()::text
  );

CREATE POLICY "Update own shop images" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = get_my_shop_id()::text
  );

CREATE POLICY "Delete own shop images" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = get_my_shop_id()::text
  );
