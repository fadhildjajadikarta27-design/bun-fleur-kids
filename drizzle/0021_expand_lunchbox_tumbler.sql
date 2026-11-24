-- Expand catalog while retaining all historical orders and commissions.
ALTER TABLE public.birthday_prices DROP CONSTRAINT IF EXISTS birthday_prices_product_id_check;
ALTER TABLE public.birthday_prices ADD CONSTRAINT birthday_prices_product_id_check CHECK(product_id IN ('poster','rewardchart','papercraft','namestickers','celengan','puzzle','tshirt','placemat','growthchart','wallclock','nightlamp','kidswatch','lunchbox','tumbler'));
ALTER TABLE public.birthday_events DROP CONSTRAINT IF EXISTS birthday_events_items_check;
ALTER TABLE public.birthday_events ADD CONSTRAINT birthday_events_items_check CHECK(jsonb_typeof(items)='array' AND jsonb_array_length(items) BETWEEN 1 AND 14);
ALTER TABLE public.shop_bundles DROP CONSTRAINT IF EXISTS shop_bundles_product_ids_check;
ALTER TABLE public.shop_bundles ADD CONSTRAINT shop_bundles_product_ids_check CHECK(jsonb_typeof(product_ids)='array' AND jsonb_array_length(product_ids) BETWEEN 2 AND 14);
INSERT INTO public.product_prices(product_id,price) VALUES ('kidswatch',239000),('lunchbox',199000),('tumbler',219000) ON CONFLICT(product_id) DO UPDATE SET price=EXCLUDED.price;
INSERT INTO public.product_costs(product_id,unit_cost) VALUES ('lunchbox',85000),('tumbler',95000) ON CONFLICT(product_id) DO UPDATE SET unit_cost=EXCLUDED.unit_cost;
INSERT INTO public.birthday_prices(product_id,price) VALUES ('kidswatch',219000),('lunchbox',189000),('tumbler',209000) ON CONFLICT(product_id) DO UPDATE SET price=EXCLUDED.price;
UPDATE public.shop_bundles SET price=309000 WHERE id='little-timekeeper';
UPDATE public.shop_bundles SET price=289000 WHERE id='little-superstar';
UPDATE public.shop_bundles SET price=279000 WHERE id='little-explorer-premium';
UPDATE public.shop_bundles SET product_ids='["poster","rewardchart","papercraft","namestickers","celengan","puzzle","tshirt","placemat","growthchart","wallclock","nightlamp","kidswatch","lunchbox","tumbler"]',price=1379000 WHERE id='complete-collection';
