-- Preserve any earlier closed-beta referral credits; do not award them twice.
ALTER TABLE public.holly_accounts
 ADD COLUMN email_verified boolean NOT NULL DEFAULT false,
 ADD COLUMN inviter_reward integer NOT NULL DEFAULT 0 CHECK(inviter_reward>=0),
 ADD COLUMN signup_reward integer NOT NULL DEFAULT 0 CHECK(signup_reward>=0),
 ADD COLUMN verification_hash text,
 ADD COLUMN verification_expires_at timestamptz,
 ADD COLUMN verification_sent_at timestamptz;
UPDATE public.holly_accounts SET inviter_reward=5000,signup_reward=10000 WHERE invited_by IS NOT NULL;
