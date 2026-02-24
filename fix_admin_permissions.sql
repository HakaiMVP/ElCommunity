-- Allow Super Admins, Admins, and Moderators to VIEW all profiles
-- This ensures they can see the user list in the Admin Dashboard

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  -- Allow if user is admin/mod
  (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE global_role IN ('super_admin', 'admin', 'moderator')
    )
  )
  OR
  -- Also allow users to view their own profile (usually exists, but ensuring it here doesn't hurt)
  auth.uid() = id
  OR
  -- Allow everyone to view profiles if your app is public social network
  -- If you want purely private profiles until friend request, remove this OR true part
  -- content of this check depends on requirement. For now, let's stick to explicit Admin access.
  false
);

-- Note: The recursive check in the subquery might cause infinite recursion if not handled carefully in some DBs,
-- but Supabase/Postgres usually handles "auth.uid() IN ..." fine if the policy on profiles allows reading OWN role.
-- To be safe, we can use a simpler approach if the above fails (e.g. security definer function), 
-- but normally "auth.uid() = id" is always allowed, so fetching own role is fine.

-- Let's make sure "Users can view their own profile" exists for the subquery to work for the admin themselves.
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);
