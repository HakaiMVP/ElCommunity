/* 
  RUN THIS IN SUPABASE SQL EDITOR TO RESTORE MISSING CONTENT
  This script links your Guides and Market Items to the new Profiles system.
*/

-- 1. Guides: Link author_id to public.profiles
-- First, try to remove existing constraint if it points to auth.users (optional but cleaner)
ALTER TABLE public.guides DROP CONSTRAINT IF EXISTS guides_author_id_fkey;

-- Add new constraint pointing to profiles
ALTER TABLE public.guides
ADD CONSTRAINT guides_author_id_fkey_profiles
FOREIGN KEY (author_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- 2. Market Items: Link user_id to public.profiles
ALTER TABLE public.market_items DROP CONSTRAINT IF EXISTS market_items_user_id_fkey;

ALTER TABLE public.market_items
ADD CONSTRAINT market_items_user_id_fkey_profiles
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- 3. Ensure RLS Policies allow public viewing of content
-- Guides
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public guides are viewable by everyone." ON public.guides;
CREATE POLICY "Public guides are viewable by everyone." ON public.guides FOR SELECT USING (true);

-- Market
ALTER TABLE public.market_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public market items are viewable by everyone." ON public.market_items;
CREATE POLICY "Public market items are viewable by everyone." ON public.market_items FOR SELECT USING (true);


-- 4. Verify all content implies valid profiles
-- (This just ensures no orphaned content exists that would be hidden)
-- If a user was deleted from auth.users, their content might be hidden. 
-- For now, we assume users exist.
