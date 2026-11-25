-- Classify existing orders by the currently registered affiliate phone list.
-- Do not overwrite amounts already paid or delete commission/payout history.
UPDATE orders AS o
SET affiliate_self_order = true
WHERE NOT o.affiliate_self_order
  AND length(regexp_replace(o.whatsapp, '[^0-9]', '', 'g')) BETWEEN 9 AND 15
  AND EXISTS (
    SELECT 1
    FROM affiliates AS a
    WHERE length(regexp_replace(a.whatsapp, '[^0-9]', '', 'g')) BETWEEN 9 AND 15
      AND regexp_replace(regexp_replace(a.whatsapp, '[^0-9]', '', 'g'), '^62', '0')
          = regexp_replace(regexp_replace(o.whatsapp, '[^0-9]', '', 'g'), '^62', '0')
  );
--> statement-breakpoint
-- Reversal removes unpaid commission entitlement from the payable balance.
-- Retain paid_amount, payout_id and all historical payout rows for audit.
-- Already fully paid commissions remain paid and are excluded from KPI in code.
WITH reversed AS (
  UPDATE commissions AS c
  SET status = 'reversed', updated_at = now()
  FROM orders AS o
  WHERE c.order_id = o.id AND o.affiliate_self_order
    AND c.status IN ('pending', 'confirmed', 'payable')
  RETURNING c.affiliate_id, c.order_id
)
INSERT INTO affiliate_audit (affiliate_id, action, detail, created_at)
SELECT affiliate_id, 'commission.self_order_reversed',
       'Komisi belum cair dibatalkan untuk pesanan internal ID ' || order_id::text, now()
FROM reversed;
