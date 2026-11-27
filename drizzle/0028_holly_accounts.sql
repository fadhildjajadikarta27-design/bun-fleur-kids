CREATE TABLE public.holly_accounts (
 id text PRIMARY KEY,name text NOT NULL,email text NOT NULL UNIQUE,salt text NOT NULL,password_hash text NOT NULL,
 referral_code text NOT NULL UNIQUE,invited_by text REFERENCES public.holly_accounts(id),pending_bonus integer NOT NULL DEFAULT 0 CHECK(pending_bonus>=0),
 progress jsonb,revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),CHECK(invited_by IS NULL OR invited_by<>id)
);
CREATE INDEX holly_accounts_inviter_idx ON public.holly_accounts(invited_by);
CREATE TABLE public.holly_sessions (
 hash text PRIMARY KEY,account_id text NOT NULL REFERENCES public.holly_accounts(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL
);
ALTER TABLE public.holly_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holly_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.holly_accounts,public.holly_sessions FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON public.holly_accounts,public.holly_sessions FROM anon; END IF;
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON public.holly_accounts,public.holly_sessions FROM authenticated; END IF;
END $$;
