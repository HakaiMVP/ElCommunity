-- Communities Table
CREATE TABLE IF NOT EXISTS communities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_private BOOLEAN DEFAULT false,
    image_url TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    members_count INTEGER DEFAULT 1
);

-- Community Members Table
CREATE TABLE IF NOT EXISTS community_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member', -- 'admin', 'moderator', 'member'
    status TEXT DEFAULT 'approved', -- 'approved', 'pending', 'rejected'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(community_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_communities_created_at ON communities(created_at);
CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_community_id ON community_members(community_id);

-- Enable RLS
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;

-- Policies for Communities
CREATE POLICY "Communities are viewable by everyone" 
ON communities FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can create communities" 
ON communities FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = created_by);

-- Policies for Community Members
CREATE POLICY "Members are viewable by everyone" 
ON community_members FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users can join public communities directly" 
ON community_members FOR INSERT 
TO authenticated 
WITH CHECK (
    auth.uid() = user_id AND 
    (
        SELECT is_private FROM communities WHERE id = community_id
    ) = false
);

CREATE POLICY "Users can request to join private communities" 
ON community_members FOR INSERT 
TO authenticated 
WITH CHECK (
    auth.uid() = user_id AND 
    status = 'pending'
);

-- Dummy Data for Exploration
INSERT INTO communities (name, description, is_private, members_count, image_url)
VALUES 
('RPG Brasil', 'A maior comunidade de RPG de mesa do Brasil!', false, 1250, 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80'),
('Devs Frontend', 'Javascript, React e CSS. Conversas sérias.', false, 340, 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?auto=format&fit=crop&q=80'),
('Elite Snipers (Privado)', 'Clã fechado para jogadores de elite.', true, 15, 'https://images.unsplash.com/photo-1599557297033-0402ca219717?auto=format&fit=crop&q=80')
ON CONFLICT (name) DO NOTHING;
