-- Force Cleanup of Ownerless Communities
-- This script manually deletes dependencies before deleting the community to ensure no FK constraints block it.

-- 1. Create a temporary table to store IDs of communities to be deleted
CREATE TEMP TABLE communities_to_delete AS
SELECT id FROM communities c
WHERE NOT EXISTS (
    SELECT 1 FROM community_members cm
    WHERE cm.community_id = c.id
    AND cm.role = 'admin'
);

-- 2. Delete Members of these communities
DELETE FROM community_members
WHERE community_id IN (SELECT id FROM communities_to_delete);

-- 3. Delete Posts (and by cascade, comments and likes)
DELETE FROM community_posts
WHERE community_id IN (SELECT id FROM communities_to_delete);

-- 4. Delete the Communities
DELETE FROM communities
WHERE id IN (SELECT id FROM communities_to_delete);

-- 5. Clean up
DROP TABLE communities_to_delete;
