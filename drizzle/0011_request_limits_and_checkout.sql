CREATE TABLE IF NOT EXISTS public.request_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.request_limits FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.request_limits FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.request_limits FROM authenticated;
  END IF;
END $$;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_key text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_key_unique ON public.orders (checkout_key)
WHERE checkout_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_open_qris_total_idx ON public.orders ((total + unique_code))
WHERE pay_state IN ('awaiting', 'waiting_verification', 'unmatched') AND unique_code > 0;
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS projects_owner_updated_idx ON public.projects (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS commissions_affiliate_status_idx ON public.commissions (affiliate_id, status);
CREATE INDEX IF NOT EXISTS payouts_affiliate_status_idx ON public.payouts (affiliate_id, status);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 20);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_unique ON public.orders (payment_reference)
WHERE payment_reference IS NOT NULL;

-- Existing bearer tokens must be retired when switching to one-way storage.
UPDATE public.affiliate_sessions SET revoked_at = COALESCE(revoked_at, now()), token = 'retired:' || id
WHERE token NOT LIKE 'retired:%';

CREATE TABLE IF NOT EXISTS public.payment_proofs (
  order_id integer PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  mime text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png')),
  data text NOT NULL CHECK (length(data) <= 1000000),
  updated_at timestamptz NOT NULL
);
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_proofs FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.payment_proofs FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.payment_proofs FROM authenticated;
  END IF;
END $$;

ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS paid_amount integer NOT NULL DEFAULT 0
CHECK (paid_amount >= 0 AND paid_amount <= amount);
UPDATE public.commissions SET paid_amount = amount WHERE status = 'paid' AND paid_amount = 0;
CREATE INDEX IF NOT EXISTS request_limits_expiry_idx ON public.request_limits (expires_at);
