-- Enable REPLICA IDENTITY FULL to ensure DELETE events include all columns
-- This is critical for Realtime subscriptions that filter by non-PK columns (like user_id or friend_id)

alter table public.friendships replica identity full;
alter table public.messages replica identity full;
