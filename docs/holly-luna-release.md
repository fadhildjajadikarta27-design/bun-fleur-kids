# Holly & Luna — deployment checklist (beta only)

Approved referral rules: 500 village coin to inviter, 1,000 to new account, maximum 10 successful new accounts per inviter. No multiplier for referral. Credits are server-side, atomic on signup. No email confirmation. Email/password signups can be abused with disposable emails; do not count referrals toward prizes. Existing beta credits, if any, are preserved.

## Release gates
- CI must pass build, unit, integration, legacy upgrade, browser tests.
- Before opening beta, review privacy notice/consent for parent accounts and account recovery process.
- Back up production database; review/apply only 0028_holly_accounts.sql, 0029_holly_email_verification.sql (legacy reward ledger columns), and 0030_holly_google_login.sql through the existing migration journal in order. Never use a disposable test database or auto-run production migrations from a request.
- Create a Google Cloud OAuth client of type Web application, authorize JavaScript origin https://bunandfleurkids.fun, configure the consent screen, and set HOLLY_GOOGLE_CLIENT_ID in Netlify server environment. The public client ID is returned to the login UI; no client secret is required by the ID-token popup flow. Test with an authorized adult Google account before opening beta. Email/password accounts with the same email are not auto-linked; continue with the original password. No Resend/email confirmation required.
- HOLLY_LUNA_PREVIEW_ENABLED remains off by default. Enable only after explicit production approval and migration/Google login checks.
- Netlify build command and publish folder remain unchanged.
- No automatic deployment. Merge to main only with release approval.

## Commercial features NOT enabled
Daily Free 15-minute limit, paid Rp59,000/month Premium and 2x multiplier, mini-game rewards, and monthly real-world prize competition are not implemented. Village coins remain virtual, non-redeemable, and browser gameplay progress is not yet authoritative. Do not activate a prize leaderboard until server-authoritative actions, equal competition opportunity, eligibility/rules, child safety, anti-abuse, and payment/refund/account recovery are implemented and tested.
