/**
 * Thai / English address parsing, composition, and grouping helpers.
 */

export const EMPTY_ADDRESS_PARTS = () => ({
  house_no: '',
  moo: '',
  street_line: '',
  subdistrict: '',
  district: '',
  province: '',
  postal_code: '',
});

export function normalizeAddressKey(text) {
  return (text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
    .trim();
}

export function makeAddressGroupKey(address, addressEn) {
  return `${normalizeAddressKey(address)}||${normalizeAddressKey(addressEn || '')}`;
}

export function parseThaiAddress(text) {
  const parts = EMPTY_ADDRESS_PARTS();
  let s = (text || '').replace(/\s+/g, ' ').trim();
  if (!s) return parts;

  let m = s.match(/\s(\d{5})$/);
  if (m) {
    parts.postal_code = m[1];
    s = s.slice(0, m.index).trim();
  }

  m = s.match(/\s(?:จังหวัด|จ\.)\s*(.+)$/i);
  if (m) {
    parts.province = m[1].trim();
    s = s.slice(0, m.index).trim();
  } else {
    m = s.match(/\s(กรุงเทพมหานคร|กรุงเทพฯ|กรุงเทพมหานคร|กรุงเทพ|กทม\.?)$/i);
    if (m) {
      parts.province = 'กรุงเทพมหานคร';
      s = s.slice(0, m.index).trim();
    }
  }

  m = s.match(/\s(?:อำเภอ|อ\.|เขต)\s*(.+)$/i);
  if (m) {
    parts.district = m[1].trim();
    s = s.slice(0, m.index).trim();
  }

  m = s.match(/\s(?:ตำบล|ต\.|แขวง)\s*(.+)$/i);
  if (m) {
    parts.subdistrict = m[1].trim();
    s = s.slice(0, m.index).trim();
  }

  m = s.match(/\s(?:หมู่|ม\.)\s*(\d+)\b/i);
  if (m) {
    parts.moo = m[1];
    s = (s.slice(0, m.index) + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
  }

  m = s.match(/^(\d+(?:\/\d+)?(?:-\d+)?)/);
  if (m) {
    parts.house_no = m[1];
    parts.street_line = s.slice(m[0].length).trim();
  } else {
    parts.street_line = s;
  }

  return parts;
}

export function parseEnglishAddress(text) {
  const parts = EMPTY_ADDRESS_PARTS();
  let s = (text || '').replace(/\s+/g, ' ').trim();
  if (!s) return parts;

  let m = s.match(/\s(\d{5})\s*$/);
  if (!m) m = s.match(/,?\s*(\d{5})\s*$/);
  if (m) {
    parts.postal_code = m[1];
    s = s.slice(0, m.index).replace(/,\s*$/, '').trim();
  }

  const chunks = s.split(',').map(c => c.trim()).filter(Boolean);
  if (chunks.length >= 4) {
    parts.house_no = chunks[0];
    parts.street_line = chunks[1];
    parts.subdistrict = chunks[2];
    parts.district = chunks[3];
    parts.province = chunks.slice(4).join(', ');
    return parts;
  }

  if (chunks.length === 3) {
    parts.house_no = chunks[0];
    parts.street_line = chunks[1];
    parts.district = chunks[2];
    return parts;
  }

  m = s.match(/^(\d+(?:\/\d+)?(?:-\d+)?)\s+(.+)$/);
  if (m) {
    parts.house_no = m[1];
    parts.street_line = m[2];
  } else {
    parts.street_line = s;
  }

  return parts;
}

function isBangkokProvince(province) {
  return /กรุงเทพ/.test(province || '');
}

export function buildThaiAddress(parts) {
  const p = { ...EMPTY_ADDRESS_PARTS(), ...parts };
  const segs = [];
  if (p.house_no) segs.push(p.house_no);
  if (p.street_line) segs.push(p.street_line);
  if (p.moo) segs.push(`หมู่ ${p.moo}`);
  if (p.subdistrict) {
    segs.push(`${isBangkokProvince(p.province) ? 'แขวง' : 'ตำบล'}${p.subdistrict}`);
  }
  if (p.district) {
    segs.push(`${isBangkokProvince(p.province) ? 'เขต' : 'อำเภอ'}${p.district}`);
  }
  if (p.province) {
    segs.push(isBangkokProvince(p.province) ? 'กรุงเทพมหานคร' : `จังหวัด${p.province.replace(/^จังหวัด/, '')}`);
  }
  if (p.postal_code) segs.push(p.postal_code);
  return segs.join(' ').replace(/\s+/g, ' ').trim();
}

export function buildEnglishAddress(parts) {
  const p = { ...EMPTY_ADDRESS_PARTS(), ...parts };
  const segs = [];
  const line1 = [p.house_no, p.street_line].filter(Boolean).join(' ');
  if (line1) segs.push(line1);
  if (p.moo) segs.push(`Moo ${p.moo}`);
  if (p.subdistrict) segs.push(p.subdistrict);
  if (p.district) segs.push(p.district);
  if (p.province) segs.push(p.province);
  if (p.postal_code) segs.push(p.postal_code);
  return segs.join(', ').replace(/\s+/g, ' ').trim();
}

export function partsFromRecord(record, lang = 'th') {
  const stored = lang === 'en' ? record?.parts_en : record?.parts;
  if (stored && (stored.house_no || stored.street_line || stored.subdistrict || stored.district || stored.province)) {
    return { ...EMPTY_ADDRESS_PARTS(), ...stored };
  }
  const text = lang === 'en' ? (record?.address_en || '') : (record?.address || '');
  return lang === 'en' ? parseEnglishAddress(text) : parseThaiAddress(text);
}

export function groupAddresses(addresses) {
  const map = new Map();
  for (const addr of addresses || []) {
    const key = makeAddressGroupKey(addr.address, addr.address_en);
    if (!map.has(key)) {
      map.set(key, {
        key,
        address: addr.address || '',
        address_en: addr.address_en || '',
        records: [],
        company_ids: [],
      });
    }
    const group = map.get(key);
    group.records.push(addr);
    if (addr.company_id && !group.company_ids.includes(addr.company_id)) {
      group.company_ids.push(addr.company_id);
    }
  }
  return Array.from(map.values());
}

export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}