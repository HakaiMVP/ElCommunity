-- Add last_nickname_change column if it doesn't exist
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='last_nickname_change') then
    alter table public.profiles add column last_nickname_change timestamp with time zone;
  end if;
end $$;

-- Function to enforce the 7-day nickname change restriction
create or replace function public.check_nickname_change()
returns trigger as $$
begin
  -- Check if the nickname (username) is being changed
  if (old.username is distinct from new.username) then
    -- Check if it has been less than 7 days since the last change
    if (old.last_nickname_change is not null and old.last_nickname_change > now() - interval '7 days') then
      raise exception 'Nickname can only be changed once every 7 days. Last change was at %', old.last_nickname_change;
    end if;
    
    -- If nickname is changing and it's allowed, update the timestamp
    new.last_nickname_change := now();
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Create the trigger
drop trigger if exists nickname_change_restriction on public.profiles;
create trigger nickname_change_restriction
  before update on public.profiles
  for each row execute procedure public.check_nickname_change();

-- Also update existing metadata sync to respect this if needed, but the BEFORE trigger on profiles should handle it.
-- However, we should ensure the initial handle_profile_sync doesn't overwrite last_nickname_change to null.
