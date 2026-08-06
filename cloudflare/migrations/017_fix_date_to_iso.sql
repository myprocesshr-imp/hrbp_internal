-- Convert Thai date strings in request_data JSON to ISO format
-- Buddhist Era year - 543 = Gregorian year

UPDATE requests
SET request_data = json_set(request_data, '$.date', '2026-07-22')
WHERE json_extract(request_data, '$.date') = '22 ก.ค. 2569';

UPDATE requests
SET request_data = json_set(request_data, '$.date', '2026-07-23')
WHERE json_extract(request_data, '$.date') = '23 ก.ค. 2569';

UPDATE requests
SET request_data = json_set(request_data, '$.date', '2026-07-24')
WHERE json_extract(request_data, '$.date') = '24 ก.ค. 2569';
