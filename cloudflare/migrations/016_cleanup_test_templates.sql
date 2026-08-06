-- Migration 016: Remove test templates from database
-- Keep only the 3 official templates
DELETE FROM templates WHERE id NOT IN ('tpl-work-th', 'tpl-work-en', 'tpl-visa-abroad');
