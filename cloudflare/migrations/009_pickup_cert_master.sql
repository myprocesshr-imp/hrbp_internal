-- Migration 009: Add pickup_locations and cert_master_data tables

CREATE TABLE IF NOT EXISTS pickup_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Default pickup locations
INSERT OR IGNORE INTO pickup_locations (name) VALUES
  ('DAP'),
  ('IP1-อาคารพลาซ่า2'),
  ('One BKK');

-- cert_master_data: stores arrays of companies, addresses, notes as JSON per key
CREATE TABLE IF NOT EXISTS cert_master_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed default cert master data
INSERT OR IGNORE INTO cert_master_data (key, value) VALUES
  ('companies', '[{"id":"c1","name":"บริษัท สิทธิชัย จำกัด","name_en":"Sittichai Company Limited"},{"id":"c2","name":"บริษัท ไทยพัฒนา อินเตอร์กรุ๊ป จำกัด","name_en":"Thai Pattana Intergroup Company Limited"}]'),
  ('addresses', '[{"id":"a1","company_id":"c1","address":"123/45 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110","address_en":"123/45 Sukhumvit Rd., Khlong Toei, Bangkok 10110"},{"id":"a2","company_id":"c2","address":"123/45 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110","address_en":"123/45 Sukhumvit Rd., Khlong Toei, Bangkok 10110"},{"id":"a3","company_id":"c1","address":"789 อาคารสินธร ชั้น 12 ถ.วิทยุ แขวงลุมพินี เขตปทุมวัน กรุงเทพมหานคร 10330","address_en":"789 Sindhorn Building 12th Fl., Wireless Rd., Lumphini, Pathum Wan, Bangkok 10330"},{"id":"a4","company_id":"c2","address":"456 ถ.รามคำแหง แขวงหัวหมาก เขตบางกะปิ กรุงเทพมหานคร 10240","address_en":"456 Ramkhamhaeng Rd., Hua Mak, Bang Kapi, Bangkok 10240"}]'),
  ('notes', '[{"text":"เพื่อยื่นกู้ธนาคาร","text_en":"For bank loan application"},{"text":"เพื่อขอวีซ่าประเทศ","text_en":"For visa application"},{"text":"เพื่อศึกษาต่อ","text_en":"For further education"},{"text":"เพื่อใช้ยื่นต่อหน่วยงานราชการ","text_en":"For submission to government agencies"},{"text":"เพื่อใช้แสดงรายได้","text_en":"For income verification"}]');
