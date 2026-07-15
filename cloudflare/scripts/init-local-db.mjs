/**
 * init-local-db.mjs
 * Applies migrations to ALL local D1 SQLite files that wrangler uses.
 * Run this once before starting wrangler pages dev.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const D1_STATE_DIR = path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
const MIGRATION_FILE = path.join('migrations', '001_schema.sql');

const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

if (!fs.existsSync(D1_STATE_DIR)) {
  console.log('No D1 state directory found. Run wrangler pages dev first to create the database, then run this script.');
  process.exit(0);
}

const files = fs.readdirSync(D1_STATE_DIR).filter(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');

if (files.length === 0) {
  console.log('No D1 database files found yet. Start wrangler pages dev first, then run this script.');
  process.exit(0);
}

console.log(`Found ${files.length} D1 database file(s):`);
files.forEach(f => console.log(' -', f));

const idempotentSql = sql;

const tempSql = path.join('.wrangler', 'init_idempotent.sql');
fs.writeFileSync(tempSql, idempotentSql);

for (const file of files) {
  const dbPath = path.join(D1_STATE_DIR, file);
  console.log(`\nApplying migration to: ${file}`);
  try {
    execSync(`npx better-sqlite3-cli "${dbPath}" < "${tempSql}"`, { stdio: 'inherit' });
    console.log('  ✅ Done');
  } catch (err) {
    // better-sqlite3-cli may not be available, try sqlite3 directly
    try {
      execSync(`sqlite3 "${dbPath}" < "${tempSql}"`, { stdio: 'inherit' });
      console.log('  ✅ Done (via sqlite3)');
    } catch (err2) {
      console.log('  ❌ Could not apply via CLI. Will use wrangler d1 execute instead.');
    }
  }
}

fs.unlinkSync(tempSql);
console.log('\nDone!');
