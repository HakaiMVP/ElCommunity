-- 1. Create the 'avatars' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public access to read files (Select)
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- 3. Allow authenticated users to upload files (Insert)
CREATE POLICY "Authenticated Upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- 4. Allow users to update/delete their own files (Update/Delete)
CREATE POLICY "Owner Update" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' 
  AND auth.uid() = owner
);

CREATE POLICY "Owner Delete" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' 
  AND auth.uid() = owner
);
