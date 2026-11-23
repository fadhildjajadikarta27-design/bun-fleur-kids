DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id TEXT NOT NULL,
  child_name TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  name_font TEXT NOT NULL DEFAULT 'baloo',
  name_color TEXT NOT NULL DEFAULT '#E4572E',
  colors TEXT NOT NULL DEFAULT '{}',
  strokes TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  brand_name TEXT NOT NULL DEFAULT 'Bun & Fleur Kids'
);
