-- HRMS profile fields: SexID, FNameE, LNameE
ALTER TABLE users ADD COLUMN sex_id TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN fname_e TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN lname_e TEXT DEFAULT '';

UPDATE users SET sex_id = '2', fname_e = 'Alex', lname_e = 'Rivera' WHERE username = 'employee';