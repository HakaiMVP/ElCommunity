-- Add views column to guides if not exists
alter table public.guides 
add column if not exists views bigint default 0;

-- Create table to track unique views per user
create table if not exists public.guide_views (
  user_id uuid references auth.users not null,
  guide_id bigint references public.guides on delete cascade not null,
  viewed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, guide_id)
);

-- Enable RLS
alter table public.guide_views enable row level security;

-- Policies
create policy "Users can view all views" on public.guide_views for select using (true);
create policy "Users can insert their own views" on public.guide_views for insert with check (auth.uid() = user_id);

-- Function to handle view increment
create or replace function public.handle_new_view()
returns trigger as $$
begin
  update public.guides
  set views = (select count(*) from public.guide_views where guide_id = new.guide_id)
  where id = new.guide_id;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for increment
drop trigger if exists on_view_created on public.guide_views;
create trigger on_view_created
  after insert on public.guide_views
  for each row execute procedure public.handle_new_view();
