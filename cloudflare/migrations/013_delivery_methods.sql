-- Migration 013: Add delivery_methods table

CREATE TABLE IF NOT EXISTS delivery_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Default delivery methods
INSERT OR IGNORE INTO delivery_methods (name) VALUES
  ('มารับด้วยตนเอง'),
  ('ส่ง Courier'),
  ('ส่งพนักงานภายใน'),
  ('ส่งมอบโดยตรง'),
  ('อื่นๆ');
