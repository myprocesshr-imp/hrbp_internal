-- Add missing users (hrmanager1-5) and fix roles of existing users
-- Safe to run: uses INSERT OR IGNORE and UPDATE

-- Fix wipada.r role from admin → hrmanager
UPDATE users SET role = 'hrmanager' WHERE username = 'wipada.r' AND role = 'admin';

-- Fix chaiyaphol.r role from hr → hrbp
UPDATE users SET role = 'hrbp' WHERE username = 'chaiyaphol.r' AND role = 'hr';

-- Add missing HR Managers (will skip if already exist)
INSERT OR IGNORE INTO users (username, full_name, emp_id, email, phone, position, department, company_name, role, responsible_bu, start_date)
VALUES 
  ('hrmanager1', 'สมชาย รักดี', 'EMP-HR-001', 'somchai@company.com', '0811111111', 'HR Manager', 'People Operation', 'Mango', 'hrmanager', '[]', '2020-01-01'),
  ('hrmanager2', 'นภาพร ใจสว่าง', 'EMP-HR-002', 'napaporn@company.com', '0822222222', 'HR Manager', 'People Operation', 'Mango', 'hrmanager', '[]', '2019-05-15'),
  ('hrmanager3', 'กิตติพงษ์ ยอดเยี่ยม', 'EMP-HR-003', 'kittipong@company.com', '0833333333', 'HR Manager', 'People Operation', 'Mango', 'hrmanager', '[]', '2021-03-10'),
  ('hrmanager4', 'สุดารัตน์ พลเมือง', 'EMP-HR-004', 'sudarat@company.com', '0844444444', 'HR Manager', 'People Operation', 'Mango', 'hrmanager', '[]', '2018-08-20'),
  ('hrmanager5', 'ธนาธร สิทธิชัย', 'EMP-HR-005', 'thanathorn@company.com', '0855555555', 'HR Director', 'People Operation', 'Mango', 'hrmanager', '[]', '2015-11-01');
