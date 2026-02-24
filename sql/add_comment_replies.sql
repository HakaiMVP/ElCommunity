-- Add reply support to community_comments
-- parent_id = NULL means top-level comment
-- parent_id = <comment_id> means reply to that comment

ALTER TABLE community_comments 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES community_comments(id) ON DELETE CASCADE;

-- Index for fast reply lookups
CREATE INDEX IF NOT EXISTS idx_community_comments_parent_id 
ON community_comments(parent_id);
