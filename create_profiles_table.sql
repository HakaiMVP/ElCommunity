-- 1. Create the public profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  avatar_url text,
  updated_at timestamp with time zone default now()
);

-- 2. Enable RLS
alter table public.profiles enable row level security;

-- 3. Create policies
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update their own profile."
  on profiles for update
  using ( auth.uid() = id );

-- 4. Create a function to handle new user signups and metadata changes
create or replace function public.handle_profile_sync()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    now()
  )
  on conflict (id) do update
  set
    username = excluded.username,
    avatar_url = excluded.avatar_url,
    updated_at = excluded.updated_at;
  return new;
end;
$$ language plpgsql security definer;

-- 5. Create a trigger on auth.users for sync
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after insert or update on auth.users
  for each row execute procedure public.handle_profile_sync();

-- 6. Important: Populate existing data
insert into public.profiles (id, username, avatar_url, updated_at)
select 
  id, 
  coalesce(raw_user_meta_data->>'username', split_part(email, '@', 1)),
  raw_user_meta_data->>'avatar_url',
  now()
from auth.users
on conflict (id) do update
set
  username = excluded.username,
  avatar_url = excluded.avatar_url,
  updated_at = excluded.updated_at;
