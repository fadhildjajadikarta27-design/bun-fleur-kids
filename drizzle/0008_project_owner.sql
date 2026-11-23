-- Per-visitor artwork isolation. Previous ownerless records remain admin-visible only.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "owner_id" text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS "projects_owner_id_idx" ON "projects" ("owner_id");
