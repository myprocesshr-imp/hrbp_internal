/**
 * Purge all data for a user by username from local D1 databases.
 * Usage: node scripts/purge-user.mjs <username>
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const username = (process.argv[2] || '').trim().toLowerCase();

if (!username) {
  console.error('Usage: node scripts/purge-user.mjs <username>');
  process.exit(1);
}

const D1_STATE_DIR = path.join(__dirname, '..', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');

function runWrangler(sql) {
  const escaped = sql.replace(/"/g, '\\"');
  const cmd = `npx wrangler d1 execute hrbp-db --local --command "${escaped}"`;
  try {
    const out = execSync(cmd, { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return out;
  } catch (err) {
    const stdout = err.stdout?.toString() || '';
    const stderr = err.stderr?.toString() || '';
    if (stdout) return stdout;
    throw new Error(stderr || err.message);
  }
}

console.log(`\n🔍 Searching for user: ${username}`);

// Find user
const findSql = `SELECT id, username, full_name, emp_id, email FROM users WHERE lower(username) = '${username}'`;
let findOut;
try {
  findOut = runWrangler(findSql);
  console.log(findOut);
} catch (e) {
  console.error('Query failed:', e.message);
  process.exit(1);
}

// Parse user id from wrangler output (look for numeric id in results)
const idMatch = findOut.match(/\│\s*(\d+)\s*\│/);
if (!idMatch) {
  console.log(`\n⚠️  User "${username}" not found in local D1. Nothing to delete from database.`);
} else {
  const userId = idMatch[1];
  console.log(`\n🗑️  Deleting user id=${userId} and related requests...`);

  const deleteRequests = `DELETE FROM requests WHERE user_id = ${userId}`;
  const deleteUser = `DELETE FROM users WHERE id = ${userId}`;

  try {
    const reqOut = runWrangler(deleteRequests);
    console.log('Requests deleted:', reqOut.trim() || 'OK');
    const userOut = runWrangler(deleteUser);
    console.log('User deleted:', userOut.trim() || 'OK');
    console.log(`\n✅ Purged "${username}" from local D1 (user_id=${userId})`);
  } catch (e) {
    console.error('Delete failed:', e.message);
    process.exit(1);
  }
}

// Also purge from all sqlite files directly if wrangler parsing is unreliable
if (fs.existsSync(D1_STATE_DIR)) {
  const files = fs.readdirSync(D1_STATE_DIR).filter(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
  console.log(`\n📂 Checking ${files.length} sqlite file(s) directly...`);
  for (const file of files) {
    const dbPath = path.join(D1_STATE_DIR, file);
    try {
      // Use node -e with dynamic import if better-sqlite3 available, else skip
      const checkCmd = `node -e "const{Database}=require('better-sqlite3');const db=new Database(process.argv[1]);const u=db.prepare('SELECT id,username FROM users WHERE lower(username)=?').get(process.argv[2]);if(u){db.prepare('DELETE FROM requests WHERE user_id=?').run(u.id);db.prepare('DELETE FROM users WHERE id=?').run(u.id);console.log('Purged from ${file}:',u.username,'id='+u.id);}else{console.log('Not in ${file}');}db.close();" "${dbPath}" "${username}"`;
      execSync(checkCmd, { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: 'pipe' });
    } catch (_) {
      // better-sqlite3 not available — wrangler path above is sufficient
    }
  }
}

console.log('\n📋 Browser localStorage cleanup (run in DevTools Console on http://localhost:3000):');
console.log(`
(function() {
  const USER = '${username}';
  const match = u => (u.username||'').toLowerCase() === USER || (u.email||'').toLowerCase().includes(USER);
  let users = JSON.parse(localStorage.getItem('hrbp_mock_users')||'[]');
  const removed = users.filter(match);
  users = users.filter(u => !match(u));
  localStorage.setItem('hrbp_mock_users', JSON.stringify(users));
  const emails = removed.map(u => u.email).filter(Boolean);
  const empIds = removed.map(u => u.emp_id).filter(Boolean);
  const reqs = JSON.parse(localStorage.getItem('hrbp_employee_requests')||'[]')
    .filter(r => !emails.includes(r.user_email) && !empIds.some(id => (r.emp_id||'')===id));
  localStorage.setItem('hrbp_employee_requests', JSON.stringify(reqs));
  const pend = JSON.parse(localStorage.getItem('hrbp_pending_requests')||'[]')
    .filter(r => !emails.includes(r.user_email));
  localStorage.setItem('hrbp_pending_requests', JSON.stringify(pend));
  const cur = JSON.parse(localStorage.getItem('hrbp_user')||'null');
  if (cur && match(cur)) localStorage.removeItem('hrbp_user');
  console.log('Removed users:', removed.length, removed);
  console.log('Done — ${username} can login fresh now.');
})();
`);