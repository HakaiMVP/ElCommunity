-- Posts Table
CREATE TABLE IF NOT EXISTS community_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    likes_count INTEGER DEFAULT 0
);

-- Comments Table
CREATE TABLE IF NOT EXISTS community_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_community_id ON community_posts(community_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON community_comments(post_id);

-- Enable RLS
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;

-- ===========================
-- RLS POLICIES
-- ===========================

-- 1. VIEWING POSTS/COMMENTS
-- Everyone who is a member of the community (or if it's public) can see posts
CREATE POLICY "Members can view posts"
ON community_posts FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM communities c
        LEFT JOIN community_members cm ON cm.community_id = c.id AND cm.user_id = auth.uid()
        WHERE c.id = community_posts.community_id
        AND (c.is_private = false OR cm.status = 'approved')
    )
);

CREATE POLICY "Members can view comments"
ON community_comments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM community_posts cp
        JOIN communities c ON c.id = cp.community_id
        LEFT JOIN community_members cm ON cm.community_id = c.id AND cm.user_id = auth.uid()
        WHERE cp.id = community_comments.post_id
        AND (c.is_private = false OR cm.status = 'approved')
    )
);

-- 2. CREATING POSTS
-- Access Control based on 'policy_post' column in communities table
CREATE POLICY "Users can create posts based on policy"
ON community_posts FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM communities c
        JOIN community_members cm ON cm.community_id = c.id
        WHERE c.id = community_posts.community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
        AND (
            (c.policy_post = 'member') -- member+
            OR (c.policy_post = 'moderator' AND cm.role IN ('moderator', 'admin'))
            OR (c.policy_post = 'admin' AND cm.role = 'admin')
        )
    )
);

-- 3. CREATING COMMENTS
-- Access Control based on 'policy_comment' column in communities table
CREATE POLICY "Users can comment based on policy"
ON community_comments FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM community_posts cp
        JOIN communities c ON c.id = cp.community_id
        JOIN community_members cm ON cm.community_id = c.id
        WHERE cp.id = community_comments.post_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
        AND (
            (c.policy_comment = 'member') 
            OR (c.policy_comment = 'moderator' AND cm.role IN ('moderator', 'admin'))
            OR (c.policy_comment = 'admin' AND cm.role = 'admin')
        )
    )
);

-- 4. DELETING (Admins/Mods or Author)
CREATE POLICY "Authors and Admins can delete posts"
ON community_posts FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id -- Author
    OR EXISTS ( -- Or Admin/Mod
        SELECT 1 FROM community_members cm
        WHERE cm.community_id = community_posts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'moderator')
    )
);
