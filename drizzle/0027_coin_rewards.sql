CREATE TABLE public.coin_wallets (
 owner_id text PRIMARY KEY, balance integer NOT NULL DEFAULT 0 CHECK(balance>=0),
 last_check_in text NOT NULL DEFAULT '', check_in_day integer NOT NULL DEFAULT 0 CHECK(check_in_day BETWEEN 0 AND 7)
);
CREATE TABLE public.coin_play_sessions (
 owner_id text PRIMARY KEY, token text NOT NULL, game_id text NOT NULL, started_at timestamptz NOT NULL,
 minute integer NOT NULL DEFAULT 0 CHECK(minute BETWEEN 0 AND 5), valid boolean NOT NULL DEFAULT true
);
CREATE TABLE public.coin_ledger (
 key text PRIMARY KEY, owner_id text NOT NULL, source text NOT NULL CHECK(source IN ('checkin','play')),
 amount integer NOT NULL CHECK(amount IN (50,100,2500)), created_at timestamptz NOT NULL
);
CREATE INDEX coin_ledger_owner_idx ON public.coin_ledger(owner_id);
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_play_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coin_wallets,public.coin_play_sessions,public.coin_ledger FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON public.coin_wallets,public.coin_play_sessions,public.coin_ledger FROM anon; END IF;
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON public.coin_wallets,public.coin_play_sessions,public.coin_ledger FROM authenticated; END IF;
END $$;
