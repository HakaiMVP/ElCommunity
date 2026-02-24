-- Add negotiation_active column to support friends having market chats
ALTER TABLE public.friendships ADD COLUMN IF NOT EXISTS negotiation_active BOOLEAN DEFAULT FALSE;

-- Update existing market chats to have this active
UPDATE public.friendships SET negotiation_active = TRUE WHERE status = 'market';
