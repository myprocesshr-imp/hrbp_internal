-- Store full request form payload as JSON for admin/employee views
ALTER TABLE requests ADD COLUMN request_data TEXT DEFAULT '{}';