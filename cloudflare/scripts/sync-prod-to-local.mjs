import Database from 'better-sqlite3';
import { readdirSync } from 'fs';
import { join } from 'path';

const PROD_API = 'https://hrbp-system.pages.dev';
const D1_DIR = join(import.meta.dirname, '..', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');

function findLocalD1() {
  const files = readdirSync(D1_DIR).filter(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
  if (!files.length) throw new Error('No local D1 SQLite found');
  const dbPath = join(D1_DIR, files[0]);
  console.log('Local D1:', dbPath);
  return dbPath;
}

async function fetchJSON(path) {
  const res = await fetch(`${PROD_API}${path}`);
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return res.json();
}

async function main() {
  const dbPath = findLocalD1();
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF');

  console.log('--- Fetching data from production ---');

  const [usersRes, buRes, reqRes, tplRes, certRes, pickupRes] = await Promise.all([
    fetchJSON('/api/users?all=true'),
    fetchJSON('/api/business-units'),
    fetchJSON('/api/requests?limit=100'),
    fetchJSON('/api/templates'),
    fetchJSON('/api/cert-master-data'),
    fetchJSON('/api/pickup-locations'),
  ]);

  const users = usersRes.data || [];
  const bu = buRes.data || [];
  const reqs = reqsRes?.requests || reqRes.requests || [];
  const tpls = tplRes.data || [];
  const cert = certRes.data || {};
  const pickups = pickupRes.data || [];

  console.log(`Users: ${users.length}, BU: ${bu.length}, Requests: ${reqs.length}, Templates: ${tpls.length}, Pickups: ${pickups.length}`);

  const tx = db.transaction(() => {
    // Clear existing data
    db.exec('DELETE FROM requests');
    db.exec('DELETE FROM users');
    db.exec('DELETE FROM business_units');
    db.exec('DELETE FROM pickup_locations');
    db.exec('DELETE FROM templates');
    db.exec("DELETE FROM cert_master_data");

    // Insert users
    const insertUser = db.prepare('INSERT OR REPLACE INTO users (id, username, full_name, emp_id, email, phone, position, department, company_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const u of users) {
      insertUser.run(u.id, u.username, u.full_name, u.emp_id, u.email || '', u.phone || '', u.position || '', u.department || '', u.company_name || '', u.role || 'employee', u.is_active !== undefined ? (u.is_active ? 1 : 0) : 1);
    }
    console.log(`Inserted ${users.length} users`);

    // Insert business units
    const insertBU = db.prepare('INSERT OR REPLACE INTO business_units (id, name) VALUES (?, ?)');
    for (const b of bu) {
      insertBU.run(b.id, b.name);
    }
    console.log(`Inserted ${bu.length} business units`);

    // Insert pickup locations
    const insertPU = db.prepare('INSERT OR REPLACE INTO pickup_locations (id, name, created_at) VALUES (?, ?, ?)');
    for (const p of pickups) {
      insertPU.run(p.id, p.name, p.created_at || new Date().toISOString());
    }
    console.log(`Inserted ${pickups.length} pickup locations`);

    // Insert templates
    const insertTpl = db.prepare('INSERT OR REPLACE INTO templates (id, name, category, html, status, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const t of tpls) {
      insertTpl.run(t.id, t.name, t.category || '', t.html || '', t.status || 'draft', t.updated_at || new Date().toISOString());
    }
    console.log(`Inserted ${tpls.length} templates`);

    // Insert cert_master_data
    const insertCert = db.prepare('INSERT OR REPLACE INTO cert_master_data (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(cert)) {
      insertCert.run(key, JSON.stringify(value));
    }
    console.log(`Inserted ${Object.keys(cert).length} cert_master_data keys`);

    // Insert requests
    const insertReq = db.prepare(`INSERT OR REPLACE INTO requests (
      id, employee_id, employee_name, employee_email, employee_phone,
      department, position, company_name, company_id,
      doc_type, purpose, purpose_other, language, include_salary,
      delivery_method, pickup_location, destination_country,
      travel_start_date, travel_end_date, institution_name,
      notes, status, hr Officer, hr_acknowledged_at, hr_acknowledged_by,
      eta_date, attachments, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    for (const r of reqs) {
      insertReq.run(
        r.id, r.employee_id, r.employee_name, r.employee_email || '', r.employee_phone || '',
        r.department || '', r.position || '', r.company_name || '', r.company_id || '',
        r.doc_type || '', r.purpose || '', r.purpose_other || '', r.language || 'th', r.include_salary ? 1 : 0,
        r.delivery_method || 'digital', r.pickup_location || '', r.destination_country || '',
        r.travel_start_date || '', r.travel_end_date || '', r.institution_name || '',
        r.notes || '', r.status || 'submitted', r.hr_officer || '', r.hr_acknowledged_at || null, r.hr_acknowledged_by || null,
        r.eta_date || null, JSON.stringify(r.attachments || []), r.created_at || '', r.updated_at || ''
      );
    }
    console.log(`Inserted ${reqs.length} requests`);
  });

  tx();
  db.close();
  console.log('\nDone! Restart wrangler to pick up changes.');
}

main().catch(e => { console.error(e); process.exit(1); });
