-- Add Permission Settings to Communities
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS policy_post TEXT DEFAULT 'member', -- 'member', 'moderator', 'admin'
ADD COLUMN IF NOT EXISTS policy_comment TEXT DEFAULT 'member', 
ADD COLUMN IF NOT EXISTS policy_invite TEXT DEFAULT 'admin', -- Who can accept/approve members
ADD COLUMN IF NOT EXISTS policy_ban TEXT DEFAULT 'admin'; -- Who can ban users

-- Update RLS to ensure Admins can UPDATE these settings
-- (Note: Previous policies might already cover this if configured correctly, but we ensure it here)
-- We rely on the "Admins can update their community" policy created previously.

-- Allow Moderators to view Admin tab if policy allows? 
-- Generally, we need a policy for "Who can view requests". 
-- for now, we'll implement logic in Frontend, and RLS often checks for "admin" role. 
-- If we want custom roles to manage users, we might need to broaden RLS.
-- Let's stick to: "Admins" are the superusers. "Moderators" are a new role we might introducing.
