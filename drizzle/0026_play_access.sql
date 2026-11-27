CREATE TABLE public.game_trials (
 key text PRIMARY KEY, owner_id text NOT NULL, game_id text NOT NULL,
 expires_at timestamptz NOT NULL, UNIQUE(owner_id,game_id)
);
CREATE TABLE public.game_purchases (
 code text PRIMARY KEY, owner_id text NOT NULL, target text NOT NULL,
 amount integer NOT NULL CHECK((target ~ '^category-[0-4]$' AND amount=29000) OR (target !~ '^category-' AND amount=10000)),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reported','paid','cancelled','refunded')),
 payment_reference text, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE INDEX game_trials_owner_idx ON public.game_trials(owner_id);
CREATE INDEX game_purchases_owner_idx ON public.game_purchases(owner_id);
CREATE UNIQUE INDEX game_purchases_verified_reference ON public.game_purchases(payment_reference) WHERE status IN ('paid','refunded');
ALTER TABLE public.game_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_trials,public.game_purchases FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON public.game_trials,public.game_purchases FROM anon; END IF;
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON public.game_trials,public.game_purchases FROM authenticated; END IF;
END $$;
