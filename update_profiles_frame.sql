-- Add equipped_frame column to profiles table if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS equipped_frame TEXT DEFAULT NULL;

-- Policy ensures users can update their own profile (usually already exists, but good to double check)
-- Assuming existing policy "Users can update own profile" covers this column.
