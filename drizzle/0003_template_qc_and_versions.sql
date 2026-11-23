CREATE TABLE template_qc (
  template_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'needs_review',
  prototype_tested INTEGER NOT NULL DEFAULT 0,
  checks_passed INTEGER NOT NULL DEFAULT 0,
  scale_pct INTEGER NOT NULL DEFAULT 100,
  tab_depth_mm REAL NOT NULL DEFAULT 7,
  name_offset_mm REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE template_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
