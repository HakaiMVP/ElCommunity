-- Allow 'market' status in friendships
ALTER TABLE public.friendships DROP CONSTRAINT IF EXISTS friendships_status_check;
ALTER TABLE public.friendships ADD CONSTRAINT friendships_status_check CHECK (status IN ('pending', 'accepted', 'blocked', 'market'));
