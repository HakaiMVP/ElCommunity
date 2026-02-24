-- 1. Add columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS global_role text DEFAULT 'user',
ADD COLUMN IF NOT EXISTS custom_permissions jsonb DEFAULT '[]'::jsonb;

-- 2. Create RLS Policies for Super Admin / Admin / Moderator

-- A. POSTS: Allow Admins to DELETE any post
DROP POLICY IF EXISTS "Admins can delete any post" ON community_posts;
CREATE POLICY "Admins can delete any post"
ON community_posts
FOR DELETE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE global_role IN ('super_admin', 'admin', 'moderator')
    OR custom_permissions @> '["delete_posts"]'
  )
);

-- B. COMMENTS: Allow Admins to DELETE any comment
DROP POLICY IF EXISTS "Admins can delete any comment" ON community_comments;
CREATE POLICY "Admins can delete any comment"
ON community_comments
FOR DELETE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE global_role IN ('super_admin', 'admin', 'moderator')
    OR custom_permissions @> '["delete_comments"]'
  )
);

-- C. PROFILES: Allow Super Admin to UPDATE any profile (to change roles)
DROP POLICY IF EXISTS "Super Admin can update profiles" ON profiles;
CREATE POLICY "Super Admin can update profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE global_role = 'super_admin'
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE global_role = 'super_admin'
  )
);

-- 3. Function to initialize the first Super Admin (Optional helper)
-- REPLACE 'SEU_EMAIL_AQUI' WITH YOUR EMAIL (e.g. 'admin@elcommunity.com')
UPDATE profiles
SET global_role = 'super_admin'
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'SEU_EMAIL_AQUI'
);
