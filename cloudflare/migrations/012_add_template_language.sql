-- Migration 012: Add language column to templates table
-- Values: 'th' (Thai), 'en' (English), 'both' (Both languages)
-- Default: 'th' for backward compatibility

ALTER TABLE templates ADD COLUMN language TEXT DEFAULT 'th' CHECK(language IN ('th', 'en', 'both'));

-- Update existing seed templates with correct language values
UPDATE templates SET language = 'th' WHERE id = 'tpl-work-th';
UPDATE templates SET language = 'en' WHERE id = 'tpl-work-en';
UPDATE templates SET language = 'en' WHERE id = 'tpl-visa-abroad';