-- Allow Admins and Super Admins to view and manage ALL items in user_items
-- This fixes the issue where Admins see an empty inventory when viewing other users' items.

-- Drop the policy if it already exists to prevent errors on re-run
DROP POLICY IF EXISTS "Admins can manage all items" ON public.user_items;

CREATE POLICY "Admins can manage all items"
ON public.user_items
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND global_role IN ('super_admin', 'admin')
    )
);
