-- ========================================================
-- FIX & CONSOLIDATE PERMISSIONS
-- Run this to resolve "Error saving settings"
-- ========================================================

-- 1. Ensure Columns Exist (Safe to run if already there)
ALTER TABLE communities ADD COLUMN IF NOT EXISTS policy_post TEXT DEFAULT 'member';
ALTER TABLE communities ADD COLUMN IF NOT EXISTS policy_comment TEXT DEFAULT 'member';
ALTER TABLE communities ADD COLUMN IF NOT EXISTS policy_invite TEXT DEFAULT 'admin';
ALTER TABLE communities ADD COLUMN IF NOT EXISTS policy_ban TEXT DEFAULT 'admin';

-- 2. RESET Policies (Drop old ones to avoid conflicts/duplicates)
DROP POLICY IF EXISTS "Admins can update their community" ON communities;
DROP POLICY IF EXISTS "Admins can update member status" ON community_members;
DROP POLICY IF EXISTS "Admins can remove members" ON community_members;

-- 3. RE-CREATE Policies (Robust Version)

-- Allow Admins to UPDATE their Community Settings
CREATE POLICY "Admins can update their community"
ON communities FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM community_members
        WHERE community_id = communities.id
        AND user_id = auth.uid()
        AND role = 'admin'
        AND status = 'approved'
    )
);

-- Allow Admins to UPDATE Members (Approve/Promote)
CREATE POLICY "Admins can update member status"
ON community_members FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM community_members cm
        WHERE cm.community_id = community_members.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.status = 'approved'
    )
);

-- Allow Admins to DELETE Members (Ban/Reject)
CREATE POLICY "Admins can remove members"
ON community_members FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM community_members cm
        WHERE cm.community_id = community_members.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.status = 'approved'
    )
);
