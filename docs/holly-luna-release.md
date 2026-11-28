# Holly & Luna — deployment checklist (beta only)

Approved referral rules: 500 village coin to inviter, 1,000 to new account, maximum 10 successfully verified invitations per account. No multiplier for referral. Credits are server-side, on email verification; unverified signups do not consume successful quota. If the quota fills before verification, the email can still be verified without either bonus. Existing beta credits, if any, are preserved.

## Release gates
- CI must pass build, unit, integration, legacy upgrade, browser tests.
- Before opening beta, review privacy notice/consent for parent accounts and account recovery process.
- Back up production database; review/apply only 0028_holly_accounts.sql and 0029_holly_email_verification.sql through the existing migration journal in order. Never use a disposable test database or auto-run production migrations from a request.
- Configure server-side HOLLY_RESEND_API_KEY and HOLLY_EMAIL_FROM (verified sender). Verify actual email delivery with a consenting parent test account. No keys in source/browser.
- HOLLY_LUNA_PREVIEW_ENABLED remains off by default. Enable only after explicit production approval and migration/email checks.
- Netlify build command and publish folder remain unchanged.
- No automatic deployment. Merge to main only with release approval.

## Commercial features NOT enabled
Daily Free 15-minute limit, paid Rp59,000/month Premium and 2x multiplier, mini-game rewards, and monthly real-world prize competition are not implemented. Village coins remain virtual, non-redeemable, and browser gameplay progress is not yet authoritative. Do not activate a prize leaderboard until server-authoritative actions, equal competition opportunity, eligibility/rules, child safety, anti-abuse, and payment/refund/account recovery are implemented and tested.
