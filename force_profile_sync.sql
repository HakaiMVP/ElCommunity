/*
  FORCE SYNC PROFILES (RUN THIS IF AVATARS ARE MISSING)
  
  This script forces the public.profiles table to update with the fresh data 
  from auth.users (metadata), ensuring that if you have an avatar in your 
  Auth Metadata, it gets copied to the Profiles table.
*/

-- Update existing profiles with latest metadata from auth.users
UPDATE public.profiles p
SET
  username = COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)),
  avatar_url = u.raw_user_meta_data->>'avatar_url',
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id;

-- Insert any missing profiles (just in case)
INSERT INTO public.profiles (id, username, avatar_url, updated_at)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)),
  raw_user_meta_data->>'avatar_url',
  now()
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Verification: Check what we have
SELECT id, username, avatar_url FROM public.profiles LIMIT 10;
