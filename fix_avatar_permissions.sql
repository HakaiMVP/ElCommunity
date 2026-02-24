/* 
  RUN THIS IN SUPABASE SQL EDITOR TO FIX AVATAR VISIBILITY
*/

-- 1. Ensure the 'avatars' bucket exists and is marked as PUBLIC
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- 3. Create 'SELECT' policy to allow everyone to SEE images in the 'avatars' bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- 4. Create 'INSERT' policy to allow owners to upload
-- Filenames start with user_id, e.g. "uuid-123.jpg"
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK ( 
  bucket_id = 'avatars' 
  AND auth.uid()::text = split_part(name, '-', 1) 
);

-- 5. Create 'UPDATE' policy
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING ( 
  bucket_id = 'avatars' 
  AND auth.uid()::text = split_part(name, '-', 1) 
);

-- 6. Create 'DELETE' policy
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING ( 
  bucket_id = 'avatars' 
  AND auth.uid()::text = split_part(name, '-', 1) 
);

-- 7. Ensure profiles table has a safety trigger check
-- Re-run the sync for current users to be sure
INSERT INTO public.profiles (id, username, avatar_url, updated_at)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)),
  raw_user_meta_data->>'avatar_url',
  NOW()
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET
  username = EXCLUDED.username,
  avatar_url = EXCLUDED.avatar_url,
  updated_at = EXCLUDED.updated_at;
