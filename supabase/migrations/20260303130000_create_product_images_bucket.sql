-- Create product-images storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their shop folder
CREATE POLICY "Authenticated upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Allow public read access
CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Allow authenticated users to update/delete their own uploads
CREATE POLICY "Authenticated update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');
