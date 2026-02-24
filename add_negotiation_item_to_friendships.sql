ALTER TABLE public.friendships 
ADD COLUMN negotiation_item_id BIGINT REFERENCES public.market_items(id) ON DELETE SET NULL;
