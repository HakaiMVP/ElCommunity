-- Create a new search function that returns the display_id
create or replace function public.search_users_with_ids(search_term text)
returns table (
  id uuid,
  username text,
  avatar_url text,
  display_id bigint
)
security definer
as $$
begin
  return query
  select
    p.id,
    p.username,
    p.avatar_url,
    p.display_id
  from public.profiles p
  where
    (p.username ilike '%' || search_term || '%')
    OR
    (p.id::text ilike '%' || search_term || '%')
  limit 20;
end;
$$ language plpgsql;
