ALTER TABLE public.holly_accounts ADD COLUMN google_sub text UNIQUE;
CREATE TABLE public.holly_google_challenges(hash text PRIMARY KEY,expires_at timestamptz NOT NULL);
ALTER TABLE public.holly_google_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.holly_google_challenges FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON public.holly_google_challenges FROM anon; END IF;
 IF EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON public.holly_google_challenges FROM authenticated; END IF;
END $$;
