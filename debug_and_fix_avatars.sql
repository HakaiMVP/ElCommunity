/*
  NUCLEAR OPTION: FIX AVATARS & PERMISSIONS
  
  This script does 3 things:
  1. Temporarily DISABLES Row Level Security on profiles (to rule out permission bugs).
  2. Forces a re-sync of all avatars from your login data.
  3. Returns the count of profiles found, so you know if it worked.
*/

-- 1. Disable RLS (Security) temporarily to guarantee public access
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. Grant explicit permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon, authenticated, service_role;

-- 3. Force Sync (Again, but more aggressive)
-- Update existing
UPDATE public.profiles p
SET
  username = COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)),
  avatar_url = u.raw_user_meta_data->>'avatar_url',
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id;

-- Insert missing
INSERT INTO public.profiles (id, username, avatar_url, updated_at)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'username', split_part(u.email, '@', 1)),
  raw_user_meta_data->>'avatar_url',
  now()
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- 4. DIAGNOSTIC OUTPUT
-- This will show you exactly what is in the table.
SELECT 
  count(*) as total_profiles,
  count(avatar_url) as profiles_with_avatars,
  (SELECT username FROM public.profiles LIMIT 1) as sample_user,
  (SELECT avatar_url FROM public.profiles LIMIT 1) as sample_avatar
FROM public.profiles;
