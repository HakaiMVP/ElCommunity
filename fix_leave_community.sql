-- Allow users to leave communities (DELETE their own membership row)

-- First, drop the existing policy to avoid "policy already exists" error
DROP POLICY IF EXISTS "Members can leave community" ON community_members;

-- Re-create the policy
CREATE POLICY "Members can leave community"
ON community_members
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
