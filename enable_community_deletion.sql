-- Allow Admins and Owners to DELETE communities

DROP POLICY IF EXISTS "Admins can delete communities" ON communities;

CREATE POLICY "Admins can delete communities"
ON communities
FOR DELETE
TO authenticated
USING (
  -- 1. Owner
  auth.uid() = created_by
  OR
  -- 2. Super Admin / Admin
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE global_role IN ('super_admin', 'admin')
    OR custom_permissions @> '["delete_communities"]'
  )
);
