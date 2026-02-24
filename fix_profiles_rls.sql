/*
  FIX PROFILES PERMISSIONS (RUN THIS IF AVATARS ARE STILL MISSING)
  
  This script ensures that EVERYONE (even visitors) can see user profiles 
  (names and avatars) so that they appear on public pages like Guides.
*/

-- 1. Enable RLS on profiles (standard security practice)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

-- 3. Create OPEN READ policy (Critical for Guides/Market)
CREATE POLICY "Public profiles are viewable by everyone." 
ON public.profiles FOR SELECT 
USING (true);

-- 4. Create OWNER WRITE policies (So you can still edit your profile)
CREATE POLICY "Users can insert their own profile." 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile." 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 5. Extra: Ensure Storage Bucket is Public (for avatar images)
-- (We can't change storage buckets easily via SQL here, but we can ensure the URLs work if the bucket is public)
-- If avatars are 'private' bucket, unsigned URLs won't work. 
-- Assuming standard usage: 'avatars' bucket should be public.

-- Verification
SELECT * FROM public.profiles LIMIT 5;
