/**
 * init-all-dbs.mjs
 * Apply ALL migrations to every local D1 SQLite file.
 *
 * WHY: `wrangler pages dev --d1 DB=hrbp-db` creates a separate SQLite file
 * from what `wrangler d1 execute hrbp-db --local` uses.  This script ensures
 * every local D1 database file has the full schema + seed data.
 *
 * Usage:  node scripts/init-all-dbs.mjs
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';

// Migration files that are safe to run idempotently.
// 003 (templates seed) contains raw HTML — must run as whole file, not split.
// 005 (ALTER TABLE) fails if columns already exist — must check first.
// 007 (DROP+RENAME) fails if requests_new already exists — must check first.
const MIGRATION_FILES = [
  'migrations/001_schema.sql',
  'migrations/002_templates.sql',
  'migrations/003_seed_templates.sql',
  'migrations/004_patch_roles.sql',
  'migrations/005_hrms_profile_fields.sql',
  'migrations/006_request_data.sql',
  'migrations/007_cancelled_status.sql',
  'migrations/008_sync_dev_users.sql',
  'migrations/009_pickup_cert_master.sql',
  'migrations/010_signature_url.sql',
];

if (!fs.existsSync(D1_DIR)) {
  console.error('D1 state directory not found. Please run wrangler dev first.');
  process.exit(1);
}

// Load better-sqlite3
let Database;
try {
  const require = createRequire(import.meta.url);
  Database = require('better-sqlite3');
} catch {
  console.error('better-sqlite3 not found. Run: npm install better-sqlite3 --no-save');
  process.exit(1);
}

// Pre-read all migration SQL
const migrations = MIGRATION_FILES.map((f) => {
  const fullPath = path.resolve(f);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠  Migration file not found: ${f}`);
    return null;
  }
  return { name: f, sql: fs.readFileSync(fullPath, 'utf8') };
}).filter(Boolean);

// Find all D1 SQLite files (exclude metadata.sqlite and WAL/SHM)
const files = fs.readdirSync(D1_DIR).filter(
  (f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite'
);

console.log(`Found ${files.length} SQLite database(s) to migrate.`);
console.log(`Will apply ${migrations.length} migration(s) to each.\n`);

/**
 * Check if a column exists in a table
 */
function hasColumn(db, table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

/**
 * Check if a table exists
 */
function hasTable(db, table) {
  const row = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  ).get(table);
  return !!row;
}

/**
 * Run a single migration file against a database, skipping already-applied parts.
 */
function runMigration(db, name, sql) {
  // For 005: check if columns already exist
  if (name.includes('005_hrms_profile_fields')) {
    if (hasColumn(db, 'users', 'sex_id')) {
      return 'skipped (columns already exist)';
    }
  }

  // For 007: check if requests_new already exists (partial previous run)
  if (name.includes('007_cancelled_status')) {
    if (hasTable(db, 'requests_new')) {
      // Clean up partial state
      db.exec('DROP TABLE IF EXISTS requests_new');
    }
  }

  // For 010: check if signature_url column already exists
  if (name.includes('010_signature_url')) {
    if (hasColumn(db, 'users', 'signature_url')) {
      return 'skipped (signature_url column already exists)';
    }
  }

  // Execute entire migration SQL as-is
  db.exec(sql);
  return 'applied';
}

let totalSuccess = 0;
let totalSkipped = 0;
let totalErrors = 0;

for (const file of files) {
  const dbPath = path.join(D1_DIR, file);
  console.log(`━━━ Database: ${file} (${fs.statSync(dbPath).size} bytes) ━━━`);
  const db = new Database(dbPath);

  for (const { name, sql } of migrations) {
    try {
      const result = runMigration(db, name, sql);
      if (result === 'skipped') {
        totalSkipped++;
        console.log(`  ⏭  ${name}: ${result}`);
      } else {
        totalSuccess++;
        console.log(`  ✅ ${name}: ${result}`);
      }
    } catch (err) {
      totalErrors++;
      console.error(`  ❌ ${name}: ${err.message}`);
    }
  }

  // Verify key tables exist
  const required = ['users', 'business_units', 'requests', 'templates', 'pickup_locations', 'cert_master_data'];
  const missing = required.filter((t) => !hasTable(db, t));

  if (missing.length === 0) {
    const pickupCount = db.prepare('SELECT count(*) as c FROM pickup_locations').get().c;
    const certCount = db.prepare('SELECT count(*) as c FROM cert_master_data').get().c;
    const tmplCount = db.prepare('SELECT count(*) as c FROM templates').get().c;
    console.log(`  ✅ All ${required.length} required tables present`);
    console.log(`     pickup_locations: ${pickupCount}, cert_master_data: ${certCount}, templates: ${tmplCount}`);
  } else {
    console.error(`  ❌ Missing tables: ${missing.join(', ')}`);
  }

  db.close();
  console.log('');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Done! ${totalSuccess} applied, ${totalSkipped} skipped, ${totalErrors} errors.`);
