-- Migration 011: Patch existing templates to include {{hr_signer_signature}} placeholder
-- This fixes the issue where HR Manager signatures were not shown in certificate PDFs.

-- Patch tpl-work-th
UPDATE templates
SET
  content = REPLACE(
    content,
    '<div style="height:50px;"></div>',
    '<div id="cb-sig-box" style="width:200px;height:68px;margin:0 auto 1mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">{{hr_signer_signature}}</div>'
  ),
  version = 'V 1.8'
WHERE id = 'tpl-work-th';

-- Patch tpl-work-en
UPDATE templates
SET
  content = REPLACE(
    content,
    '<div style="height:50px;"></div>',
    '<div id="cb-sig-box" style="width:200px;height:68px;margin:0 0 1mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">{{hr_signer_signature}}</div>'
  ),
  version = 'V 2.0'
WHERE id = 'tpl-work-en';

-- Patch tpl-visa-abroad
UPDATE templates
SET
  content = REPLACE(
    content,
    '<div style="height:50px;"></div>',
    '<div id="cb-sig-box" style="width:200px;height:68px;margin:0 0 1mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">{{hr_signer_signature}}</div>'
  ),
  version = 'V 2.0'
WHERE id = 'tpl-visa-abroad';
