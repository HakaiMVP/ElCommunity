-- Remove communities that do not have any ADMIN owner
-- This effectively removes "System Created" communities that were seeded without a real user as admin.

DELETE FROM communities 
WHERE id NOT IN (
    SELECT community_id 
    FROM community_members 
    WHERE role = 'admin'
);
