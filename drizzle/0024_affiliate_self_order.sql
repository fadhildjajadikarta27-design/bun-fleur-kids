ALTER TABLE orders ADD COLUMN IF NOT EXISTS affiliate_self_order boolean NOT NULL DEFAULT false;
