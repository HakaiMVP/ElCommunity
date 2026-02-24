-- 1. Updates to Posts Table
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image'; -- 'image' or 'video'

-- 2. Likes System
CREATE TABLE IF NOT EXISTS community_post_likes (
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);

-- Enable RLS for Likes
ALTER TABLE community_post_likes ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for Likes
-- View: Everyone who can view the post can view likes (simplified: authenticated users)
CREATE POLICY "Users can view likes"
ON community_post_likes FOR SELECT
TO authenticated
USING (true);

-- Insert: Authenticated users can like
CREATE POLICY "Users can like posts"
ON community_post_likes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Delete: Users can unlike
CREATE POLICY "Users can unlike posts"
ON community_post_likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. RLS for EDITING Posts/Comments (Update)
-- Allow authors to update their own posts
CREATE POLICY "Authors can update their posts"
ON community_posts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow authors to update their own comments
CREATE POLICY "Authors can update their comments"
ON community_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
