PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  emp_id TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  position TEXT DEFAULT '',
  department TEXT DEFAULT '',
  company_name TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('admin','employee','hrbp','hrmanager')),
  responsible_bu TEXT DEFAULT '[]',
  avatar_url TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  start_date TEXT DEFAULT '',
  sex_id TEXT DEFAULT '',
  fname_e TEXT DEFAULT '',
  lname_e TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO users_new (id, username, full_name, emp_id, email, phone, position, department, company_name, role, responsible_bu, avatar_url, status, start_date, sex_id, fname_e, lname_e, created_at, updated_at)
SELECT id, username, full_name, emp_id, email, phone, position, department, company_name, role, responsible_bu, avatar_url, status, start_date, sex_id, fname_e, lname_e, created_at, updated_at FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

UPDATE users SET role = 'hrmanager' WHERE username = 'chatchawan_tu';
UPDATE users SET role = 'hrmanager' WHERE username = 'ronnachai_w';

PRAGMA foreign_keys = ON;
