-- New catalog; historical order snapshots are not changed.
ALTER TABLE public.birthday_prices DROP CONSTRAINT IF EXISTS birthday_prices_product_id_check;
ALTER TABLE public.birthday_prices ADD CONSTRAINT birthday_prices_product_id_check CHECK(product_id IN ('poster','rewardchart','papercraft','namestickers','celengan','puzzle','tshirt','placemat','growthchart','wallclock','nightlamp','kidswatch'));
ALTER TABLE public.birthday_events DROP CONSTRAINT IF EXISTS birthday_events_items_check;
ALTER TABLE public.birthday_events ADD CONSTRAINT birthday_events_items_check CHECK(jsonb_typeof(items)='array' AND jsonb_array_length(items) BETWEEN 1 AND 12);
ALTER TABLE public.shop_bundles DROP CONSTRAINT IF EXISTS shop_bundles_product_ids_check;
ALTER TABLE public.shop_bundles ADD CONSTRAINT shop_bundles_product_ids_check CHECK(jsonb_typeof(product_ids)='array' AND jsonb_array_length(product_ids) BETWEEN 2 AND 12);
INSERT INTO public.product_prices(product_id,price) VALUES ('poster',29900),
 ('rewardchart',39900),
 ('papercraft',39900),
 ('namestickers',44900),
 ('celengan',59900),
 ('puzzle',69000),
 ('placemat',79900),
 ('tshirt',79000),
 ('growthchart',99000),
 ('wallclock',99000),
 ('nightlamp',129000),
 ('kidswatch',179000) ON CONFLICT(product_id) DO UPDATE SET price=EXCLUDED.price;
INSERT INTO public.product_costs(product_id,unit_cost) VALUES ('poster',12000),
 ('rewardchart',17000),
 ('papercraft',17000),
 ('namestickers',20000),
 ('celengan',25000),
 ('puzzle',16000),
 ('placemat',34000),
 ('tshirt',35000),
 ('growthchart',35000),
 ('wallclock',35000),
 ('nightlamp',40000),
 ('kidswatch',50000) ON CONFLICT(product_id) DO UPDATE SET unit_cost=EXCLUDED.unit_cost;
INSERT INTO public.birthday_prices(product_id,price) VALUES ('poster',24900),
 ('rewardchart',34900),
 ('papercraft',34900),
 ('namestickers',39900),
 ('celengan',54900),
 ('puzzle',59900),
 ('placemat',69900),
 ('tshirt',69900),
 ('growthchart',84900),
 ('wallclock',84900),
 ('nightlamp',115000),
 ('kidswatch',159000) ON CONFLICT(product_id) DO UPDATE SET price=EXCLUDED.price;
INSERT INTO public.shop_bundles(id,name,product_ids,price) VALUES ('little-artist','Little Artist','["poster","papercraft"]',64900),
 ('play-learn','Play & Learn','["puzzle","placemat"]',139000),
 ('little-creator','Little Creator','["tshirt","puzzle"]',129000),
 ('little-explorer','Little Explorer','["celengan","namestickers"]',94900),
 ('good-habits','Good Habits','["rewardchart","namestickers"]',79900),
 ('growing-memories','Growing Memories','["growthchart","poster"]',115000),
 ('dreamy-room','Dreamy Room','["nightlamp","wallclock"]',199000),
 ('little-timekeeper','Little Timekeeper','["kidswatch","wallclock"]',249000),
 ('little-superstar','Little Superstar','["kidswatch","tshirt"]',229000),
 ('little-explorer-premium','Little Explorer Premium','["kidswatch","puzzle"]',219000),
 ('complete-collection','Complete Collection','["poster","rewardchart","papercraft","namestickers","celengan","puzzle","tshirt","placemat","growthchart","wallclock","nightlamp","kidswatch"]',899000) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, product_ids=EXCLUDED.product_ids,price=EXCLUDED.price;
