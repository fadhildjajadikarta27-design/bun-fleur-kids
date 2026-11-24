ALTER TABLE public.affiliates
ADD COLUMN IF NOT EXISTS product_discounts jsonb NOT NULL DEFAULT '{}'::jsonb
CHECK (jsonb_typeof(product_discounts) = 'object');
