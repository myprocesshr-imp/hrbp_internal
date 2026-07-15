-- Migration to create the templates table for storing document templates in Cloudflare D1
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','disabled')),
  version TEXT NOT NULL DEFAULT 'V 1.0',
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT DEFAULT 'System'
);
