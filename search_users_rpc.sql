-- Secure function to search users by username
-- This avoids exposing the entire auth.users table
create or replace function public.search_users(search_term text)
returns table (
  id uuid,
  username text,
  avatar_url text
) 
security definer
as $$
begin
  return query
  select 
    auth.users.id, 
    COALESCE(auth.users.raw_user_meta_data->>'username', split_part(auth.users.email, '@', 1)) as username,
    COALESCE(auth.users.raw_user_meta_data->>'avatar_url', '') as avatar_url
  from auth.users
  where 
    (raw_user_meta_data->>'username' ilike '%' || search_term || '%')
    OR
    (email ilike '%' || search_term || '%')
  limit 20;
end;
$$ language plpgsql;
