-- Add equipped_effect column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS equipped_effect TEXT DEFAULT NULL;

-- Comment on column
COMMENT ON COLUMN profiles.equipped_effect IS 'Stores the class name of the equipped active chat effect (e.g., effect-yuji_black_flash)';
