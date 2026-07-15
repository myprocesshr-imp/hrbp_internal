CREATE TABLE IF NOT EXISTS business_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
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
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_code TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  language TEXT DEFAULT 'ไทย',
  salary_info INTEGER DEFAULT 1,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('draft','submitted','in-review','approved','rejected')),
  assigned_hr_id INTEGER DEFAULT NULL,
  supporting_docs TEXT DEFAULT '[]',
  certificate_pdf_key TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (assigned_hr_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

-- Seed default business units
INSERT OR IGNORE INTO business_units (name) VALUES ('Residential'), ('304IP'), ('Commercial'), ('Housing');

-- Seed default users (synced with production D1)
-- Note: sex_id, fname_e, lname_e are added by migration 005_hrms_profile_fields.sql
INSERT OR IGNORE INTO users (username, full_name, emp_id, email, phone, position, department, company_name, role, responsible_bu, status, start_date)
VALUES 
  ('admin', 'Admin User', 'EMP-2024-ADM', 'admin@company.com', '0812345678', 'Super Admin', 'People Operation', 'Mango', 'admin', '[]', 'active', ''),
  ('ronnachai_w', 'รณชัย วิจิตโต', '648087', 'ronnachai_w@mibholding.com', '0858353626', 'Process Development Officer', 'Improvement', 'บริษัท เอ็มจีที แด๊ป จำกัด', 'admin', '[]', 'active', '2021-09-16'),
  ('chatchawan_tu', 'ชัชวาลย์ ตุลาผล', '10005208', 'chatchawan_tu@mibholding.com', '0858353379', 'Operation Process Improvement Section Manager', 'Improvement', 'บริษัท ไอพี 5 จำกัด', 'admin', '[]', 'active', '2007-07-16'),
  ('penpitcha_po', 'เพ็ญพิชชา พงษ์ประสิทธิ์', '670406', 'penpitcha_po@mibholding.com', '0858351998', 'HRBP Officer', 'HR', 'บริษัท อินเตอร์ไทยคอนสตรัคชั่น จำกัด', 'hrbp', '[]', 'active', '2024-05-02'),
  -- Additional test users for local development
  ('employee', 'อเล็กซ์ ริเวร่า', 'EMP-2024-0892', 'employee@company.com', '0812345678', 'นักออกแบบผลิตภัณฑ์อาวุโส', 'การออกแบบประสบการณ์ผู้ใช้', 'Mango', 'employee', '[]', 'active', '2024-01-01'),
  ('wipada.r', 'วิภาดา รักษาธรรม', 'EMP-2024-001', 'wipada.r@company.com', '0812345678', 'HR Manager', 'People Operation', 'Mango', 'hrmanager', '[]', 'active', '2024-01-01'),
  ('hrmanager1', 'สมชาย รักดี', 'EMP-HR-001', 'somchai@company.com', '0811111111', 'HR Manager', 'People Operation', 'Mango', 'hrmanager', '[]', 'active', '2020-01-01'),
  ('hrmanager2', 'นภาพร ใจสว่าง', 'EMP-HR-002', 'napaporn@company.com', '0822222222', 'HR Manager', 'People Operation', 'Mango', 'hrmanager', '[]', 'active', '2019-05-15');

