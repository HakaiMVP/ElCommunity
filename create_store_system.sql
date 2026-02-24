-- Create user_items table to track purchased/owned items
CREATE TABLE IF NOT EXISTS public.user_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL, -- e.g., 'frame_gold', 'frame_neon'
    item_type TEXT NOT NULL, -- e.g., 'frame', 'banner', 'bundle'
    is_equipped BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, item_id) -- Prevent duplicate purchases of the same item
);

-- RLS Policies
ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own items
CREATE POLICY "Users can view their own items" 
    ON public.user_items FOR SELECT 
    USING (auth.uid() = user_id);

-- Allow users to insert (buy) items for themselves
CREATE POLICY "Users can insert their own items" 
    ON public.user_items FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Allow users to update (equip/unequip) their own items
CREATE POLICY "Users can update their own items" 
    ON public.user_items FOR UPDATE 
    USING (auth.uid() = user_id);

-- Create a view or function to easily check if a user owns an item (Optional, but useful)
CREATE OR REPLACE FUNCTION check_user_owns_item(p_user_id UUID, p_item_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_items 
        WHERE user_id = p_user_id AND item_id = p_item_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
