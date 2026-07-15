const Database = require('better-sqlite3');
const db = new Database('C:/Users/ACER/Desktop/Works/IMP/HR/HRBP/stitch_hrbp-internal/cloudflare/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/02c8e6929a234bd3319d8c878b9a0e1e5f027aec6a691d53ee7d6aedd838066e.sqlite');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
console.log('Local tables:', tables.map(t => t.name));
for (const t of tables) {
  const cnt = db.prepare('SELECT COUNT(*) as cnt FROM ' + t.name).get();
  console.log('  ' + t.name + ': ' + cnt.cnt + ' rows');
}
const schema = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
for (const s of schema) {
  console.log('\nSchema ' + s.name + ':', s.sql);
}
db.close();
