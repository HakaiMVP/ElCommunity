-- Fix Ambiguous Relationships
-- We explicitly name the foreign keys so we can reference them in the JS client

-- 1. Community Posts -> Profiles
-- First, try to drop the likely existing constraint (if it has the standard name)
ALTER TABLE community_posts DROP CONSTRAINT IF EXISTS community_posts_user_id_fkey;
-- If it has a random name, this DROP won't work, but adding a new named one works fine.
-- We can have multiple FKs, but we will reference the Named one.
ALTER TABLE community_posts 
    ADD CONSTRAINT community_posts_author_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;

-- 2. Community Comments -> Profiles
ALTER TABLE community_comments DROP CONSTRAINT IF EXISTS community_comments_user_id_fkey;
ALTER TABLE community_comments 
    ADD CONSTRAINT community_comments_author_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;

-- Note: We named them *_author_fkey to be very clear.
