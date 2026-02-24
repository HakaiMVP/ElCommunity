-- OPTIMIZE REALTIME & FIX DELAYS

-- 1. Set Replica Identity to FULL
-- This ensures that UPDATE events contain all columns, which is often required for Realtime to work correctly with RLS filters.
alter table public.messages replica identity full;
alter table public.friendships replica identity full;

-- 2. Force Reset Publication
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

-- 3. Add tables to publication
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.friendships;

-- 4. Verify RLS (Ensure Policies allow 'Select' for the notifications to be delivered)
-- The sender needs to be able to "see" the row when it is updated by the receiver.
-- Existing "Users can view own messages" policy covers this: using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- 5. Performance Index (Optional but good for speed)
create index if not exists messages_user_pair_idx on public.messages (sender_id, receiver_id);
create index if not exists messages_created_at_idx on public.messages (created_at desc);
