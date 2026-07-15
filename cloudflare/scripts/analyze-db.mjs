/**
 * apply-migration.mjs
 * Uses Node.js to apply SQL migration directly to a specific SQLite file
 * using the WAL bytes from the source DB.
 * 
 * Strategy: Read both WAL files and the main db, combine them, then write
 * to the target. Actually — we'll just use wrangler's own mechanism by 
 * starting wrangler pages dev briefly, getting the DB file hash it uses,
 * then running migration against it.
 */

import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';

// First, let's start wrangler pages dev briefly to get it to create its DB
// and identify which hash it uses.

// Read metadata.sqlite to find the mapping
// SQLite binary format: page 1 contains the schema
// We'll parse it as binary to find text keys

function findStringsInFile(filePath, minLen = 8) {
  const buf = fs.readFileSync(filePath);
  const strings = [];
  let current = '';
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c >= 0x20 && c < 0x7f) {
      current += String.fromCharCode(c);
    } else {
      if (current.length >= minLen) strings.push(current);
      current = '';
    }
  }
  if (current.length >= minLen) strings.push(current);
  return strings;
}

// Read metadata to find DB ID mappings
const metadataPath = path.join(D1_DIR, 'metadata.sqlite');
const metaWal = path.join(D1_DIR, 'metadata.sqlite-wal');

if (fs.existsSync(metaWal)) {
  const strs = findStringsInFile(metaWal, 10);
  console.log('Strings in metadata WAL:');
  strs.forEach(s => console.log(' ', s));
} else {
  console.log('No metadata WAL found.');
}

if (fs.existsSync(metadataPath)) {
  const strs = findStringsInFile(metadataPath, 10);
  console.log('Strings in metadata.sqlite:');
  strs.forEach(s => console.log(' ', s));
}

// List all sqlite files
const files = fs.readdirSync(D1_DIR);
console.log('\nAll files in D1 state dir:');
files.forEach(f => {
  const stat = fs.statSync(path.join(D1_DIR, f));
  console.log(`  ${f}  (${stat.size} bytes, modified: ${stat.mtime.toISOString()})`);
});
