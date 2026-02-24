-- Add a JSONB column to store the rich text/media blocks
-- This allows us to store an array of content blocks like:
-- [{"type": "text", "content": "..."}, {"type": "image", "url": "..."}, ...]
alter table public.guides 
add column if not exists blocks jsonb default '[]'::jsonb;

-- (Optional) If we wanted to migrate existing data, we could do it here, 
-- but for a prototype, we can just start using the new column for new posts.
