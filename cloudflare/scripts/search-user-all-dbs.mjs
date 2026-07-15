import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const username = (process.argv[2] || 'ronnachai_w').toLowerCase();
const D1_DIR = path.join(__dirname, '..', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');

// Dynamic import sql.js
const initSqlJs = (await import('sql.js')).default;
const SQL = await initSqlJs();

if (!fs.existsSync(D1_DIR)) {
  console.log('No D1 directory');
  process.exit(0);
}

const files = fs.readdirSync(D1_DIR).filter(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
console.log(`Searching ${files.length} DB files for "${username}"...\n`);

for (const file of files) {
  const buf = fs.readFileSync(path.join(D1_DIR, file));
  const db = new SQL.Database(buf);
  try {
    const stmt = db.prepare("SELECT id, username, full_name, emp_id, email FROM users WHERE lower(username) LIKE ?");
    stmt.bind([`%${username}%`]);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    if (rows.length) {
      console.log(`📁 ${file}:`);
      rows.forEach(r => console.log('  ', r));
    }
  } catch (e) {
    console.log(`  ${file}: no users table or error`);
  }
  db.close();
}