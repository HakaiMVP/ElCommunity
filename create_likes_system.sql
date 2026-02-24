-- Create a table to track individual likes
create table if not exists public.guide_likes (
  user_id uuid references auth.users not null,
  guide_id bigint references public.guides on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, guide_id)
);

-- Enable RLS
alter table public.guide_likes enable row level security;

-- Policies
create policy "Users can view all likes" on public.guide_likes for select using (true);
create policy "Users can insert their own likes" on public.guide_likes for insert with check (auth.uid() = user_id);
create policy "Users can delete their own likes" on public.guide_likes for delete using (auth.uid() = user_id);

-- Function to handle like increment
create or replace function public.handle_new_like()
returns trigger as $$
begin
  update public.guides
  set likes = (select count(*) from public.guide_likes where guide_id = new.guide_id)
  where id = new.guide_id;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for increment
drop trigger if exists on_like_created on public.guide_likes;
create trigger on_like_created
  after insert on public.guide_likes
  for each row execute procedure public.handle_new_like();

-- Function to handle like decrement
create or replace function public.handle_un_like()
returns trigger as $$
begin
  update public.guides
  set likes = (select count(*) from public.guide_likes where guide_id = old.guide_id)
  where id = old.guide_id;
  return old;
end;
$$ language plpgsql security definer;

-- Trigger for decrement
drop trigger if exists on_like_deleted on public.guide_likes;
create trigger on_like_deleted
  after delete on public.guide_likes
  for each row execute procedure public.handle_un_like();
