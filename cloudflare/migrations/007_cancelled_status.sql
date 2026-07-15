-- Migration 007: Add 'cancelled' status to requests.status CHECK constraint
-- Since SQLite does not support ALTER TABLE to modify CHECK constraints,
-- we recreate the table with the updated constraint and migrate data.

-- 1. Create new table with 'cancelled' added to the CHECK constraint
CREATE TABLE IF NOT EXISTS requests_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_code TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  language TEXT DEFAULT 'ไทย',
  salary_info INTEGER DEFAULT 1,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('draft','submitted','in-review','approved','rejected','cancelled')),
  assigned_hr_id INTEGER DEFAULT NULL,
  supporting_docs TEXT DEFAULT '[]',
  certificate_pdf_key TEXT DEFAULT '',
  request_data TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (assigned_hr_id) REFERENCES users(id)
);

-- 2. Copy existing data from old table to new table
INSERT INTO requests_new (
  id, request_code, user_id, purpose, language, salary_info, notes,
  status, assigned_hr_id, supporting_docs, certificate_pdf_key, request_data,
  created_at, updated_at
)
SELECT 
  id, request_code, user_id, purpose, language, salary_info, notes,
  status, assigned_hr_id, supporting_docs, certificate_pdf_key, request_data,
  created_at, updated_at
FROM requests;

-- 3. Drop old table and rename new table
DROP TABLE IF EXISTS requests;
ALTER TABLE requests_new RENAME TO requests;

-- 4. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);