import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const SEED_FILE = 'migrations/003_seed_templates.sql';

if (!fs.existsSync(D1_DIR)) {
  console.error('D1 state directory not found. Please run wrangler dev first.');
  process.exit(1);
}

const sql = fs.readFileSync(SEED_FILE, 'utf8');

// Load or install better-sqlite3
let Database;
try {
  const require = createRequire(import.meta.url);
  Database = require('better-sqlite3');
} catch (e) {
  console.log('better-sqlite3 not found, installing locally in cloudflare directory...');
  execSync('npm install better-sqlite3 --no-save', { stdio: 'inherit', cwd: 'c:\\Users\\ACER\\Desktop\\Works\\IMP\\HR\\HRBP\\stitch_hrbp-internal\\cloudflare' });
  const require = createRequire(import.meta.url);
  Database = require('better-sqlite3');
}

const files = fs.readdirSync(D1_DIR).filter(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
console.log(`Found ${files.length} SQLite databases to update templates.`);

for (const file of files) {
  const dbPath = path.join(D1_DIR, file);
  console.log(`\nUpdating templates in: ${file}`);
  const db = new Database(dbPath);
  try {
    db.exec(sql);
    console.log('✅ Templates cleared and new templates seeded successfully!');
    
    // Verify
    const tmpls = db.prepare("SELECT id, name, category FROM templates").all();
    console.log('Current templates in DB:');
    tmpls.forEach(t => console.log(` - ${t.id}: ${t.name} (${t.category})`));
  } catch (err) {
    console.error(`❌ Error updating ${file}:`, err.message);
  } finally {
    db.close();
  }
}

console.log('\nAll databases updated!');
