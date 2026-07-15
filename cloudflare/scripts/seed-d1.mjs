/**
 * seed-d1.mjs
 * Uses sql.js (pure WASM SQLite) to create a fresh SQLite database
 * with the migration schema applied, then writes it to ALL D1 sqlite files
 * in the wrangler state directory so wrangler pages dev can use it.
 * 
 * Run from the cloudflare/ directory:
 *   node ../app/seed-d1.mjs
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load sql.js from app/node_modules
const require = createRequire(import.meta.url);
const initSqlJs = require(path.join(__dirname, 'node_modules', 'sql.js'));

const D1_DIR = path.join('..', 'cloudflare', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
const MIGRATION_FILE = path.join('..', 'cloudflare', 'migrations', '001_schema.sql');

async function main() {
  // Read migration SQL
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  
  // Make idempotent
  const idempotentSql = sql
    .replace(/CREATE INDEX /g, 'CREATE INDEX IF NOT EXISTS ')
    .replace(/CREATE UNIQUE INDEX /g, 'CREATE UNIQUE INDEX IF NOT EXISTS ');

  console.log('Initializing sql.js...');
  const SQL = await initSqlJs();
  
  // Create a fresh in-memory DB and apply migration
  const db = new SQL.Database();
  console.log('Applying migration SQL...');
  db.run(idempotentSql);
  
  // Verify tables
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Tables created:', tables[0]?.values.flat().join(', '));
  
  const users = db.exec("SELECT id, username, role FROM users");
  console.log('Users seeded:', JSON.stringify(users[0]?.values));

  // Export as binary
  const dbBinary = db.export();
  db.close();
  
  console.log(`\nDatabase binary size: ${dbBinary.length} bytes`);

  // Write to all D1 sqlite files in the state dir
  if (!fs.existsSync(D1_DIR)) {
    console.log('D1 state dir not found. Creating it...');
    fs.mkdirSync(D1_DIR, { recursive: true });
  }

  const files = fs.readdirSync(D1_DIR).filter(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
  
  if (files.length === 0) {
    console.log('No D1 database files found. Starting fresh...');
    // Will be created when wrangler pages dev first starts
    // Save template as a known name for reference
    const outPath = path.join(D1_DIR, 'seed_template.sqlite');
    fs.writeFileSync(outPath, Buffer.from(dbBinary));
    console.log('Saved template to:', outPath);
  } else {
    console.log(`\nWriting to ${files.length} D1 database file(s):`);
    for (const file of files) {
      const filePath = path.join(D1_DIR, file);
      // Remove WAL/SHM first to avoid conflicts
      const walPath = filePath + '-wal';
      const shmPath = filePath + '-shm';
      if (fs.existsSync(walPath)) { fs.unlinkSync(walPath); console.log('  Removed WAL:', file + '-wal'); }
      if (fs.existsSync(shmPath)) { fs.unlinkSync(shmPath); console.log('  Removed SHM:', file + '-shm'); }
      
      // Write clean DB
      fs.writeFileSync(filePath, Buffer.from(dbBinary));
      console.log('  ✅ Written:', file, `(${dbBinary.length} bytes)`);
    }
  }

  console.log('\n✅ Done! You can now start wrangler pages dev.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
