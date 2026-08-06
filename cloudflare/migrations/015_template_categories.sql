-- Migration 015: Create template_categories table for dynamic category management
CREATE TABLE IF NOT EXISTS template_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Seed with existing hardcoded categories
INSERT OR IGNORE INTO template_categories (name, icon, sort_order, status) VALUES
  ('หนังสือรับรองการทำงาน', 'description', 1, 'active'),
  ('หนังสือรับรองเงินเดือน', 'receipt_long', 2, 'active'),
  ('หนังสือรับรองเพื่อทำวีซ่า', 'flight_takeoff', 3, 'active'),
  ('อื่นๆ', 'article', 4, 'active');
