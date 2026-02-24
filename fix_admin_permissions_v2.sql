-- Create a function to check if a user is an admin/moderator
-- This function runs with SECURITY DEFINER, meaning it bypasses RLS
-- This prevents infinite recursion when RLS policies check "is_admin()"
CREATE OR REPLACE FUNCTION public.is_admin_or_mod()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND global_role IN ('super_admin', 'admin', 'moderator')
  );
$$;

-- Drop previous policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

-- Policy 2: Admins/Mods can view ALL profiles
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  is_admin_or_mod()
);

-- Also ensure UPDATE policy for Super Admin is correct
DROP POLICY IF EXISTS "Super Admin can update profiles" ON profiles;
CREATE POLICY "Super Admin can update profiles"
ON profiles
FOR UPDATE
TO authenticated
USING (
  -- Check if user is super admin using the helper function or direct check
  (SELECT global_role FROM profiles WHERE id = auth.uid()) = 'super_admin'
)
WITH CHECK (
  (SELECT global_role FROM profiles WHERE id = auth.uid()) = 'super_admin'
);
