-- Normalize all cert_numbers from BE to CE year and renumber sequentially
-- Current duplicates: 0004/2569 and 0004/2026

-- Step 1: Convert BE years to CE in cert_number
UPDATE requests SET request_data = json_set(request_data, '$.cert_number', replace(json_extract(request_data, '$.cert_number'), '/2569', '/2026'))
WHERE json_extract(request_data, '$.cert_number') LIKE '%/2569';

-- Step 2: Renumber sequentially to resolve duplicates
-- 0001/2026 → keep
-- 0002/2026 → keep
-- 0003/2026 → keep
-- 0004/2026 → keep (first one, EC-20260722-7488)
-- 0004/2026 → 0005/2026 (EC-20260723-3283)
UPDATE requests SET request_data = json_set(request_data, '$.cert_number', '0005/2026')
WHERE request_code = 'EC-20260723-3283';

-- 0005/2026 → 0006/2026 (EC-20260723-8545)
UPDATE requests SET request_data = json_set(request_data, '$.cert_number', '0006/2026')
WHERE request_code = 'EC-20260723-8545';

-- 0006/2026 (was 0006/2569) → 0007/2026 (EC-20260723-9338)
UPDATE requests SET request_data = json_set(request_data, '$.cert_number', '0007/2026')
WHERE request_code = 'EC-20260723-9338';
