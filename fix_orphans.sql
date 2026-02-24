/*
  RUN THIS IF CONTENT IS STILL MISSING
  This script ensures every user in auth.users has a corresponding public.profile.
  It also checks for "orphaned" content (content created by users who no longer exist).
*/

-- 1. Force Sync: Insert profiles for any users who are missing them
INSERT INTO public.profiles (id, username, avatar_url, updated_at)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)),
  raw_user_meta_data->>'avatar_url',
  now()
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 2. (Optional) Check fororphans - just for your info, doesn't delete anything
-- Guides with no author
SELECT count(*) as orphaned_guides FROM public.guides 
WHERE author_id NOT IN (SELECT id FROM public.profiles);

-- Market items with no owner
SELECT count(*) as orphaned_items FROM public.market_items 
WHERE user_id NOT IN (SELECT id FROM public.profiles);

-- 3. Grant permissions again just to be safe
GRANT SELECT ON public.profiles TO postgres, anon, authenticated, service_role;
GRANT SELECT ON public.guides TO postgres, anon, authenticated, service_role;
GRANT SELECT ON public.market_items TO postgres, anon, authenticated, service_role;
