-- Migration 008: Sync local seed data with remote D1 production users
-- Run this on local D1 to match the production database schema.
-- For fresh installs: 001_schema.sql has been updated to include these users.

-- ── 1. Update business_units to match production ──
DELETE FROM business_units;
INSERT OR IGNORE INTO business_units (name) VALUES 
  ('Residential'),
  ('304IP'),
  ('Commercial'),
  ('Housing');

-- ── 2. Clear old seed users (from 001_schema.sql) ──
DELETE FROM users WHERE id > 0;

-- ── 3. Insert production-matched users ──
-- Note: sex_id, fname_e, lname_e are added by migration 005_hrms_profile_fields.sql
INSERT INTO users (username, full_name, emp_id, email, phone, position, department, company_name, role, responsible_bu, status, start_date)
VALUES 
  ('admin', 'Admin User', 'EMP-2024-ADM', 'admin@company.com', '0812345678', 'Super Admin', 'People Operation', 'Mango', 'admin', '[]', 'active', ''),
  ('ronnachai_w', 'รณชัย วิจิตโต', '648087', 'ronnachai_w@mibholding.com', '0858353626', 'Process Development Officer', 'Improvement', 'บริษัท เอ็มจีที แด๊ป จำกัด', 'admin', '[]', 'active', '2021-09-16'),
  ('chatchawan_tu', 'ชัชวาลย์ ตุลาผล', '10005208', 'chatchawan_tu@mibholding.com', '0858353379', 'Operation Process Improvement Section Manager', 'Improvement', 'บริษัท ไอพี 5 จำกัด', 'admin', '[]', 'active', '2007-07-16'),
  ('penpitcha_po', 'เพ็ญพิชชา พงษ์ประสิทธิ์', '670406', 'penpitcha_po@mibholding.com', '0858351998', 'HRBP Officer', 'HR', 'บริษัท อินเตอร์ไทยคอนสตรัคชั่น จำกัด', 'hrbp', '[]', 'active', '2024-05-02');