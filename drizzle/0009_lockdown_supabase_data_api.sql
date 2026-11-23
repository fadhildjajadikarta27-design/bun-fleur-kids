-- Harden Supabase Data API access: all customer and administrative records are served exclusively by the authenticated Vercel backend.
--> statement-breakpoint
-- The backend's postgres role owns these tables and is not affected by RLS, while Supabase anon/authenticated roles cannot query private data.
--> statement-breakpoint
-- No public policies are intentionally created. Do not add a broad SELECT policy.
--> statement-breakpoint
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.projects FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE public.projects FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.orders FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE public.orders FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.settings FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE public.settings FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.template_qc ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.template_qc FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE public.template_qc FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.template_versions FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE public.template_versions FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.affiliates FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE public.affiliates FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.affiliate_invitations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.affiliate_invitations FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE public.affiliate_invitations FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.affiliate_sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.affiliate_sessions FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE public.affiliate_sessions FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.commissions FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE public.commissions FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.payouts FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE public.payouts FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.affiliate_audit ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.affiliate_audit FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE public.affiliate_audit FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.__port_migrations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.__port_migrations FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON TABLE public.__port_migrations FROM PUBLIC;
