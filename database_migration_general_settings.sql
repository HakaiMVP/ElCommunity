-- Add cover_position to communities
ALTER TABLE communities ADD COLUMN IF NOT EXISTS cover_position TEXT DEFAULT '50% 50%';

-- Ensure Admins have permission to UPDATE this new column (already covered by existing policy, but good to double check implicitely)
-- The existing policy "Admins can update their community" uses checks on the whole row, so it should auto-include new columns.
