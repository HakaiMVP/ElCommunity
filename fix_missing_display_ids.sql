-- 1. Ensure the sequence exists
CREATE SEQUENCE IF NOT EXISTS public.user_display_id_seq START 0;

-- 2. Ensure the column exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_id bigint DEFAULT nextval('public.user_display_id_seq');

-- 3. Backfill any NULL display_ids
-- This uses the sequence to assign the next available number to any user who doesn't have one.
UPDATE public.profiles
SET display_id = nextval('public.user_display_id_seq')
WHERE display_id IS NULL;

-- 4. Ensure uniqueness (if not already there)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_display_id_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_id_key UNIQUE (display_id);
    END IF;
END $$;

-- 5. Sync the sequence to the maximum ID + 1 to prevent collisions
-- This ensures the next new user gets a fresh ID.
SELECT setval('public.user_display_id_seq', (SELECT COALESCE(MAX(display_id), 0) + 1 FROM public.profiles), false);
