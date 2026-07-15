/**
 * seed-e7352-db.mjs
 * Opens the e7352... SQLite file and applies the migration SQL directly.
 * Uses better-sqlite3 if available, otherwise falls back to built-in approach.
 */
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const TARGET_FILE = path.join(D1_DIR, 'e7352547963de7050bd7d94658afc4fe78b61811b7815da12d90be8e863abf4d.sqlite');
const MIGRATION_FILE = 'migrations/001_schema.sql';

if (!fs.existsSync(TARGET_FILE)) {
  console.error('Target DB file not found:', TARGET_FILE);
  process.exit(1);
}

const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

// Make SQL idempotent
const idempotentSql = sql
  .replace(/CREATE INDEX /g, 'CREATE INDEX IF NOT EXISTS ')
  .replace(/CREATE UNIQUE INDEX /g, 'CREATE UNIQUE INDEX IF NOT EXISTS ');

console.log('Target:', TARGET_FILE);
console.log('Applying migration...');

// Try better-sqlite3
let Database;
try {
  const require = createRequire(import.meta.url);
  Database = require('better-sqlite3');
} catch (e) {
  console.log('better-sqlite3 not found, installing...');
  execSync('npm install better-sqlite3 --no-save', { stdio: 'inherit' });
  const require = createRequire(import.meta.url);
  Database = require('better-sqlite3');
}

const db = new Database(TARGET_FILE);
try {
  db.exec(idempotentSql);
  console.log('✅ Migration applied successfully!');
  
  // Verify
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map(t => t.name).join(', '));
  
  const users = db.prepare("SELECT id, username, role FROM users").all();
  console.log('Users:', JSON.stringify(users, null, 2));
} catch (err) {
  console.error('❌ Error:', err.message);
} finally {
  db.close();
}
