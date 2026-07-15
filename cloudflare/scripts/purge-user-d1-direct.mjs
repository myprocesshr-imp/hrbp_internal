/**
 * Purge user from ALL local D1 sqlite files directly.
 * Usage: node scripts/purge-user-d1-direct.mjs <username>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const username = (process.argv[2] || '').trim().toLowerCase();

if (!username) {
  console.error('Usage: node scripts/purge-user-d1-direct.mjs <username>');
  process.exit(1);
}

const initSqlJs = (await import('sql.js')).default;
const SQL = await initSqlJs();
const D1_DIR = path.join(__dirname, '..', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');

if (!fs.existsSync(D1_DIR)) {
  console.log('No D1 directory found.');
  process.exit(0);
}

const files = fs.readdirSync(D1_DIR).filter(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
let totalPurged = 0;

for (const file of files) {
  const dbPath = path.join(D1_DIR, file);
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  try {
    const find = db.prepare('SELECT id, username, full_name, emp_id, email FROM users WHERE lower(username) = ?');
    find.bind([username]);
    const users = [];
    while (find.step()) users.push(find.getAsObject());
    find.free();

    if (!users.length) continue;

    for (const u of users) {
      // Delete related requests
      const delReq = db.prepare('DELETE FROM requests WHERE user_id = ?');
      delReq.bind([u.id]);
      delReq.step();
      const reqChanges = db.getRowsModified();
      delReq.free();

      const delUser = db.prepare('DELETE FROM users WHERE id = ?');
      delUser.bind([u.id]);
      delUser.step();
      delUser.free();

      console.log(`✅ ${file}: deleted user id=${u.id} (${u.username} / ${u.full_name}) + ${reqChanges} request(s)`);
      totalPurged++;
    }

    // Write back to disk
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (e) {
    console.warn(`⚠️  ${file}: ${e.message}`);
  }
  db.close();
}

if (totalPurged === 0) {
  console.log(`\nไม่พบ "${username}" ใน D1 sqlite files`);
} else {
  console.log(`\nลบสำเร็จ ${totalPurged} record(s) — ${username} สามารถล็อกอินใหม่ได้`);
}