ALTER TABLE public.affiliate_invitations ADD COLUMN IF NOT EXISTS encrypted_token text NOT NULL DEFAULT '';
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS reset_token_encrypted text NOT NULL DEFAULT '';

-- Reissue any outstanding legacy invitation/reset link. Plaintext bearer
-- tokens must not survive the migration.
UPDATE public.affiliate_invitations
SET revoked_at = COALESCE(revoked_at, now()), token = 'retired:' || id
WHERE token NOT LIKE 'retired:%';
UPDATE public.affiliates
SET reset_token = '', reset_expires_at = NULL
WHERE reset_token <> '';
CREATE UNIQUE INDEX IF NOT EXISTS affiliates_pin_reset_digest_idx ON public.affiliates (reset_token)
WHERE reset_token <> '';
