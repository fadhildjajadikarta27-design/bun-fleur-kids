-- Read-only reconciliation. Run only on an authorized database; no mutation.
-- Registration events are not necessarily distinct people. Do not infer PINs
-- or recreate accounts from the audit log.
BEGIN TRANSACTION READ ONLY;
SELECT count(*) AS registration_events,
       count(DISTINCT affiliate_id) AS distinct_logged_affiliate_ids,
       count(*) FILTER (WHERE a.id IS NOT NULL) AS events_with_account,
       count(*) FILTER (WHERE a.id IS NULL) AS events_without_account
FROM affiliate_audit l
LEFT JOIN affiliates a ON a.id = l.affiliate_id
WHERE l.action = 'affiliate.self_registered';
SELECT status, count(*) AS accounts FROM affiliates GROUP BY status ORDER BY status;
SELECT l.affiliate_id, min(l.created_at) AS first_logged_at, count(*) AS events
FROM affiliate_audit l
LEFT JOIN affiliates a ON a.id = l.affiliate_id
WHERE l.action = 'affiliate.self_registered' AND a.id IS NULL
GROUP BY l.affiliate_id ORDER BY first_logged_at;
ROLLBACK;
