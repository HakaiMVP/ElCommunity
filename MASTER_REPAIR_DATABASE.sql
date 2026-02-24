/* 
  MASTER REPAIR SQL - RUN THIS IN SUPABASE SQL EDITOR
  This script fixes:
  1. Profile synchronization (nickname/avatar)
  2. Sequential ID system (Nickname#0)
  3. Avatar visibility (Storage bucket permissions)
  4. Automatic triggers to keep data updated
*/

-- 1. FIX PROFILES TABLE & IDS
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username text,
  avatar_url text,
  updated_at timestamp with time zone DEFAULT now()
);

-- Add display_id column and sequence if not exists
CREATE SEQUENCE IF NOT EXISTS public.user_display_id_seq START 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_id bigint DEFAULT nextval('public.user_display_id_seq');

-- Enable RLS and set public policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. FIX SYNC TRIGGER
CREATE OR REPLACE FUNCTION public.handle_profile_sync()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = EXCLUDED.updated_at;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_profile_sync();

-- 3. FIX STORAGE PERMISSIONS (Avatars)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = split_part(name, '-', 1));
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = split_part(name, '-', 1));

-- 4. DEEP SYNC - Force update all existing users right now
INSERT INTO public.profiles (id, username, avatar_url, updated_at)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)),
  raw_user_meta_data->>'avatar_url',
  now()
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET
  username = EXCLUDED.username,
  avatar_url = EXCLUDED.avatar_url,
  updated_at = EXCLUDED.updated_at;

-- Sync the ID sequence to avoid duplicates
SELECT setval('public.user_display_id_seq', (SELECT COALESCE(MAX(display_id), -1) + 1 FROM public.profiles), false);

-- 5. FIX SEARCH FUNCTION
CREATE OR REPLACE FUNCTION public.search_users_with_ids(search_term text)
RETURNS TABLE (id uuid, username text, avatar_url text, display_id bigint)
SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.username, p.avatar_url, p.display_id
  FROM public.profiles p
  WHERE (p.username ILIKE '%' || search_term || '%') OR (p.id::text ILIKE '%' || search_term || '%')
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;
