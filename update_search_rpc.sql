-- Update the search function to also search by display_id if the term looks like a number or starts with #
create or replace function public.search_users_with_ids(search_term text)
returns table (
  id uuid,
  username text,
  avatar_url text,
  display_id bigint
)
security definer
as $$
declare
  clean_term text;
  id_term bigint;
begin
  clean_term := replace(search_term, '#', '');
  
  -- Try to see if it's a numeric ID
  begin
    id_term := clean_term::bigint;
  exception when others then
    id_term := null;
  end;

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
    OR
    (id_term is not null and p.display_id = id_term)
  limit 20;
end;
$$ language plpgsql;
