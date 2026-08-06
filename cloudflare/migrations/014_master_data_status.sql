-- Add status column to master data tables (active/inactive)
ALTER TABLE business_units ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE pickup_locations ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE delivery_methods ADD COLUMN status TEXT DEFAULT 'active';
