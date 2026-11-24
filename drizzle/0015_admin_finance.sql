-- Admin-only cost estimates, separate from historical orders and prices.
CREATE TABLE IF NOT EXISTS public.product_costs (
  product_id text PRIMARY KEY,
  unit_cost integer NOT NULL CHECK (unit_cost BETWEEN 0 AND 10000000)
);
CREATE TABLE IF NOT EXISTS public.monthly_operating_costs (
  month text PRIMARY KEY CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount integer NOT NULL CHECK (amount BETWEEN 0 AND 2000000000)
);
ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_operating_costs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_costs, public.monthly_operating_costs FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.product_costs, public.monthly_operating_costs FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.product_costs, public.monthly_operating_costs FROM authenticated;
  END IF;
END $$;
