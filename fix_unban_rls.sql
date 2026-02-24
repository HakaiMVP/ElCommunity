-- 1. DROP old policy if it exists (names might vary, but we'll try to be thorough)
DROP POLICY IF EXISTS "Admins/Mods can manage bans" ON public.user_bans;
DROP POLICY IF EXISTS "Admins can update user status" ON public.profiles;

-- 2. Create a cleaner, more robust policy for user_bans
-- This avoids recursion by using direct checks on auth.uid() role
CREATE POLICY "Admins/Mods can manage bans"
ON public.user_bans
FOR ALL
TO authenticated
USING (
    (SELECT global_role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'admin', 'moderator')
)
WITH CHECK (
    (SELECT global_role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'admin', 'moderator')
);

-- 3. Ensure admins can update profiles (for status sync if needed)
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    (SELECT global_role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
)
WITH CHECK (
    (SELECT global_role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
);

-- 4. Grant full permissions to service_role (just in case)
GRANT ALL ON public.user_bans TO service_role;
GRANT ALL ON public.user_warnings TO service_role;
