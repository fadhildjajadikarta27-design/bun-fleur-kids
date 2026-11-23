-- One affiliate account per normalized phone number. Phone is now the login identifier.
-- Legacy records may store 62...; public signup normalizes Indonesian +62/62 to 0.
-- Avoid duplicate phone accounts even during concurrent self-service registrations.
CREATE UNIQUE INDEX IF NOT EXISTS affiliates_phone_normalized_unique
ON public.affiliates ((
  CASE WHEN whatsapp LIKE '62%' THEN '0' || substring(whatsapp FROM 3) ELSE whatsapp END
))
WHERE whatsapp <> '';
