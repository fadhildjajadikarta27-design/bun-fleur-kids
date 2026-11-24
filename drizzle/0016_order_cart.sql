-- Preserve existing orders; empty items identifies historical single-product orders.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD CONSTRAINT orders_items_array CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) <= 20);
-- 0011 limited quantity to 20 for single-product orders. A cart may include up to 140 units.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_quantity_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_quantity_check CHECK (quantity BETWEEN 1 AND 140);
