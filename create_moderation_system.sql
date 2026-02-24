-- 1. Add status column to profiles if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'; -- 'active', 'banned', 'suspended'

-- 2. Create User Warnings Table
CREATE TABLE IF NOT EXISTS public.user_warnings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES public.profiles(id),
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create User Bans Table
CREATE TABLE IF NOT EXISTS public.user_bans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES public.profiles(id),
    reason TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL = permanent
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Warnings: Admins/Mods can INSERT and VIEW
CREATE POLICY "Admins/Mods can manage warnings"
ON public.user_warnings
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND global_role IN ('super_admin', 'admin', 'moderator')
    )
);

-- Warnings: Users can VIEW their own
CREATE POLICY "Users can view own warnings"
ON public.user_warnings
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
);

-- Bans: Admins/Mods can INSERT and VIEW
CREATE POLICY "Admins/Mods can manage bans"
ON public.user_bans
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND global_role IN ('super_admin', 'admin', 'moderator')
    )
);

-- Bans: Users can VIEW their own
CREATE POLICY "Users can view own bans"
ON public.user_bans
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
);

-- 6. Grant update on status column to admins (already covered by "Super Admin can update profiles" but let's be safe for mods/admins too if we want them to ban)
-- For now, let's allow Admins and Moderators to update status too, or restrict to Admin/Super Admin
CREATE POLICY "Admins can update user status"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND global_role IN ('super_admin', 'admin') -- Mods usually can't ban outright without approval, but let's stick to admins for now
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND global_role IN ('super_admin', 'admin')
    )
);
