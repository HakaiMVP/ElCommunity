-- Force RESET Realtime for Social System
begin;
  -- Drop existing publication to clear any stuck state
  drop publication if exists supabase_realtime;

  -- Create fresh publication
  create publication supabase_realtime;
commit;

-- Enable Realtime for tables (Critical Step)
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.friendships;

-- Verify RLS Policies are correct for Realtime
alter table public.messages enable row level security;
alter table public.friendships enable row level security;
