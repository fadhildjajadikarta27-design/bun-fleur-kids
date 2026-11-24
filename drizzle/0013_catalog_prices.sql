CREATE TABLE IF NOT EXISTS public.product_prices (
  product_id text PRIMARY KEY,
  price integer NOT NULL CHECK (price BETWEEN 1000 AND 10000000)
);
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_prices FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.product_prices FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.product_prices FROM authenticated;
  END IF;
END $$;
