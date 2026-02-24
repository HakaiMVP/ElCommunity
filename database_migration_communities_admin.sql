-- ========================================================
-- Community Admin Policies
-- Run this to enable Admin features (Approve, Kick, Edit)
-- ========================================================

-- 1. Allow admins to update their community details (Name, Desc, etc)
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

-- 2. Allow admins to update member statuses (Approve pending requests)
-- Note: We check if the *executor* is an admin of the same community
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

-- 3. Allow admins to kick members or reject requests
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
