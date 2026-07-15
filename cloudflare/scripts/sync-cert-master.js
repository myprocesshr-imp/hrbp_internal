const Database = require('better-sqlite3');

const D1_PATH = 'C:/Users/ACER/Desktop/Works/IMP/HR/HRBP/stitch_hrbp-internal/cloudflare/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/02c8e6929a234bd3319d8c878b9a0e1e5f027aec6a691d53ee7d6aedd838066e.sqlite';
const PROD_API = 'https://hrbp-system.pages.dev';

async function main() {
  console.log('Fetching cert-master-data from production API...');
  const res = await fetch(`${PROD_API}/api/cert-master-data`);
  const { data } = await res.json();

  for (const [key, value] of Object.entries(data)) {
    const arr = Array.isArray(value) ? value : Object.values(value);
    console.log(`  ${key}: ${arr.length} items`);
  }

  const db = new Database(D1_PATH);
  db.pragma('journal_mode = WAL');

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM cert_master_data').run();
    const insert = db.prepare('INSERT INTO cert_master_data (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(data)) {
      insert.run(key, JSON.stringify(value));
    }
  });
  tx();

  // Verify
  const after = db.prepare('SELECT key, value FROM cert_master_data').all();
  for (const row of after) {
    const parsed = JSON.parse(row.value);
    const count = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
    console.log(`  Verified ${row.key}: ${count} items`);
  }

  db.close();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
