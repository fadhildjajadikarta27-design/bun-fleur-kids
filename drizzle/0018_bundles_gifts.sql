ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bundle_name text NOT NULL DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gift jsonb;
CREATE TABLE IF NOT EXISTS public.shop_bundles (
 id text PRIMARY KEY, name text NOT NULL, product_ids jsonb NOT NULL CHECK(jsonb_typeof(product_ids)='array' AND jsonb_array_length(product_ids) BETWEEN 2 AND 7), price integer NOT NULL CHECK(price BETWEEN 1000 AND 70000000), active integer NOT NULL DEFAULT 1 CHECK(active IN(0,1))
);
INSERT INTO public.shop_bundles(id,name,product_ids,price) VALUES
 ('little-artist','Little Artist','["poster","papercraft"]',54900),
 ('play-learn','Play & Learn','["puzzle","placemat"]',109000),
 ('little-creator','Little Creator','["tshirt","puzzle"]',129000),
 ('complete-collection','Complete Collection','["poster","papercraft","placemat","celengan","puzzle","growthchart","tshirt"]',349000)
ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.shop_bundles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_bundles FROM PUBLIC;
DO $$
BEGIN
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON public.shop_bundles FROM anon; END IF;
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON public.shop_bundles FROM authenticated; END IF;
END $$;
