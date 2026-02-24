-- 1. Create a sequence starting at 0
CREATE SEQUENCE IF NOT EXISTS public.user_display_id_seq START 0;

-- 2. Add the display_id column to the profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_id bigint DEFAULT nextval('public.user_display_id_seq');

-- 3. Ensure uniqueness
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_display_id_key UNIQUE (display_id);

-- 4. Update existing profiles to have a sequential ID
-- This will assign IDs 0, 1, 2... based on the creation date (updated_at)
WITH updated_profiles AS (
  SELECT id, row_number() OVER (ORDER BY updated_at ASC) - 1 as new_id
  FROM public.profiles
)
UPDATE public.profiles p
SET display_id = up.new_id
FROM updated_profiles up
WHERE p.id = up.id;

-- 5. Sync the sequence to the next available number
SELECT setval('public.user_display_id_seq', (SELECT COALESCE(MAX(display_id), -1) + 1 FROM public.profiles), false);
