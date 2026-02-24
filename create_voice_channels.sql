-- Create community_channels table
CREATE TABLE IF NOT EXISTS community_channels (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'voice' NOT NULL, -- 'voice', 'text', etc.
  user_limit INT DEFAULT 0, -- 0 = unlimited
  position INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Basic RLS for community_channels
ALTER TABLE community_channels ENABLE ROW LEVEL SECURITY;

-- Everyone can view channels of communities they have access to (public or member)
CREATE POLICY "View channels" ON community_channels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = community_channels.community_id
      AND (
        NOT c.is_private 
        OR EXISTS (
          SELECT 1 FROM community_members cm
          WHERE cm.community_id = c.id
          AND cm.user_id = auth.uid()
          AND cm.status = 'approved'
        )
      )
    )
  );

-- Only admins can insert/update/delete channels
CREATE POLICY "Manage channels" ON community_channels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_channels.community_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    )
  );


-- Create voice_participants table (Ephemeral state, but good to have in DB for synchronization)
CREATE TABLE IF NOT EXISTS voice_participants (
  channel_id UUID REFERENCES community_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  muted BOOLEAN DEFAULT false,
  deafened BOOLEAN DEFAULT false,
  PRIMARY KEY (channel_id, user_id)
);

-- Ensure a user is only in ONE channel at a time (globally or per community? Globally is safer for voice)
-- We can enforce this via application logic or a trigger. For now, application logic.
-- Actually, a unique constraint on user_id would enforce "one channel per user" globally if we want that.
-- Let's stick to simple PK for now and handle "move" logic in app.

ALTER TABLE voice_participants ENABLE ROW LEVEL SECURITY;

-- Everyone can see who is in a channel
CREATE POLICY "View participants" ON voice_participants
  FOR SELECT USING (true);

-- Users can join (insert) themselves
CREATE POLICY "Join channel" ON voice_participants
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- Users can update their own state (mute/deaf)
CREATE POLICY "Update self state" ON voice_participants
  FOR UPDATE USING (
    auth.uid() = user_id
  );

-- Users can leave (delete) themselves
CREATE POLICY "Leave channel" ON voice_participants
  FOR DELETE USING (
    auth.uid() = user_id
  );
