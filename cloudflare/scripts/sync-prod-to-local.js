const Database = require('better-sqlite3');
const { execSync } = require('child_process');

const D1_PATH = 'C:/Users/ACER/Desktop/Works/IMP/HR/HRBP/stitch_hrbp-internal/cloudflare/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/02c8e6929a234bd3319d8c878b9a0e1e5f027aec6a691d53ee7d6aedd838066e.sqlite';

function queryProd(sql) {
  const result = execSync(
    `npx wrangler d1 execute hrbp-db --remote --command "${sql.replace(/"/g, '\\"')}"`,
    { cwd: 'C:/Users/ACER/Desktop/Works/IMP/HR/HRBP/stitch_hrbp-internal/cloudflare', encoding: 'utf8', timeout: 15000 }
  );
  const match = result.match(/"results"\s*:\s*(\[[\s\S]*?\])\s*,\s*"success"/);
  if (!match) return [];
  return JSON.parse(match[1]);
}

console.log('Fetching production requests...');
const prodReqs = queryProd('SELECT * FROM requests ORDER BY id');
console.log(`Found ${prodReqs.length} requests in production`);

console.log('Fetching production cert_master_data...');
const prodCert = queryProd('SELECT key, value FROM cert_master_data');
console.log(`Found ${prodCert.length} cert_master_data keys`);

console.log('Fetching production templates...');
const prodTpl = queryProd('SELECT * FROM templates');
console.log(`Found ${prodTpl.length} templates`);

console.log('Fetching production pickup_locations...');
const prodPU = queryProd('SELECT * FROM pickup_locations');
console.log(`Found ${prodPU.length} pickup locations`);

const db = new Database(D1_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

const tx = db.transaction(() => {
  // Sync requests
  const delReq = db.prepare('DELETE FROM requests');
  delReq.run();
  const insertReq = db.prepare(`INSERT INTO requests (id, request_code, user_id, purpose, language, salary_info, notes, status, assigned_hr_id, supporting_docs, certificate_pdf_key, request_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const r of prodReqs) {
    insertReq.run(r.id, r.request_code, r.user_id, r.purpose, r.language, r.salary_info, r.notes, r.status, r.assigned_hr_id, r.supporting_docs, r.certificate_pdf_key, r.request_data, r.created_at, r.updated_at);
  }
  console.log(`Inserted ${prodReqs.length} requests`);

  // Sync cert_master_data
  db.prepare('DELETE FROM cert_master_data').run();
  const insertCert = db.prepare('INSERT INTO cert_master_data (key, value) VALUES (?, ?)');
  for (const c of prodCert) {
    insertCert.run(c.key, c.value);
  }
  console.log(`Inserted ${prodCert.length} cert_master_data keys`);

  // Sync templates
  db.prepare('DELETE FROM templates').run();
  const insertTpl = db.prepare('INSERT INTO templates (id, name, category, content, status, version, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (const t of prodTpl) {
    insertTpl.run(t.id, t.name, t.category, t.content, t.status, t.version, t.updated_at, t.updated_by);
  }
  console.log(`Inserted ${prodTpl.length} templates`);

  // Sync pickup_locations
  db.prepare('DELETE FROM pickup_locations').run();
  const insertPU = db.prepare('INSERT INTO pickup_locations (id, name, created_at) VALUES (?, ?, ?)');
  for (const p of prodPU) {
    insertPU.run(p.id, p.name, p.created_at);
  }
  console.log(`Inserted ${prodPU.length} pickup locations`);
});

tx();
db.close();
console.log('\nSync complete! Restart wrangler to apply.');
