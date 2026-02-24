-- Enable RLS on guides if not already enabled (it should be, but good to be safe)
ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

-- Policy for UPDATE
-- Allow author OR Super Admin / Admin / Moderator to update
CREATE POLICY "Users can update their own guides or admins can"
ON guides
FOR UPDATE
TO authenticated
USING (
  auth.uid() = author_id
  OR
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE global_role IN ('super_admin', 'admin', 'moderator')
    OR custom_permissions @> '["manage_guides"]'
  )
);

-- Policy for DELETE
-- Allow author OR Super Admin / Admin / Moderator to delete
CREATE POLICY "Users can delete their own guides or admins can"
ON guides
FOR DELETE
TO authenticated
USING (
  auth.uid() = author_id
  OR
  auth.uid() IN (
    SELECT id FROM profiles 
    WHERE global_role IN ('super_admin', 'admin', 'moderator')
    OR custom_permissions @> '["delete_guides"]'
  )
);
