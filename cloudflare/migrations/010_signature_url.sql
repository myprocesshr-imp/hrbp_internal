-- Add signature_url column to users table for R2-based signature storage
ALTER TABLE users ADD COLUMN signature_url TEXT DEFAULT '';
