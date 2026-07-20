/**
 * Company Address Service
 * Unified resolution of company name + address from master data + fallback.
 * Eliminates the duplicated logic that existed in 7+ places across the codebase.
 *
 * Usage:
 *   const result = resolveCompanyAddress(employee, lang);
 *   result.coNameTh / coNameEn / addressTh / addressEn / address
 */

// ── Fallback addresses (used when master data is unavailable) ──────────────
const FALLBACK_ADDRESSES = [
  {
    match: (name) => {
      const n = (name || '').toLowerCase();
      return n.includes('mango') || n.includes('แมงโก้');
    },
    th: '123 อาคารสิริภิญโญ ชั้น 8 ถนนศรีอยุธยา แขวงถนนพญาไท เขตราชเทวี กรุงเทพมหานคร 10400',
    en: '123 Siripinyo Building, 8th Floor, Sri Ayutthaya Road, Ratchathewi, Bangkok 10400',
  },
  {
    match: (name) => {
      const n = (name || '').toLowerCase();
      return n.includes('corporate') || n.includes('คอร์ปอเรท');
    },
    th: '456 อาคารออลซีซั่นส์ เพลส ชั้น 20 ถนนวิทยุ แขวงลุมพินี เขตปทุมวัน กรุงเทพมหานคร 10330',
    en: '456 All Seasons Place, 20th Floor, Wireless Road, Pathum Wan, Bangkok 10330',
  },
  {
    match: (name) => {
      const n = (name || '').toLowerCase();
      return n.includes('hrbp') || n.includes('เอชอาร์บีพี');
    },
    th: '789 อาคารเอ็มไพร์ ทาวเวอร์ ชั้น 35 ถนนสาทรใต้ แขวงยานนาวา เขตสาทร กรุงเทพมหานคร 10120',
    en: '789 Empire Tower, 35th Floor, South Sathorn Road, Sathon, Bangkok 10120',
  },
];

const DEFAULT_FALLBACK = {
  th: '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110',
  en: '123/45 Sukhumvit Road, Khlong Toei, Bangkok 10110',
};

// ── Company name mapping (when master data is unavailable) ─────────────────
const COMPANY_MAP = {
  'Mango':      { th: 'บริษัท แมงโก้ จำกัด',                   en: 'Mango Company Limited' },
  'Corporate':  { th: 'บริษัท คอร์ปอเรท คลาริตี้ จำกัด',        en: 'Corporate Clarity Company Limited' },
  'HRBP Group': { th: 'บริษัท เอชอาร์บีพี กรุ๊ป จำกัด',          en: 'HRBP Group Company Limited' },
};

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Find a company record in master data by fuzzy matching.
 */
function findMasterCompany(companies, companyName) {
  if (!companyName || !companies?.length) return null;
  const q = companyName.trim().toLowerCase();
  return companies.find(c => {
    const th = (c.name || '').toLowerCase();
    const en = (c.name_en || '').toLowerCase();
    return (th && (q.includes(th) || th.includes(q)))
        || (en && (q.includes(en) || en.includes(q)));
  }) || null;
}

/**
 * Load master data from localStorage cache (set by API fetch).
 */
function loadCertMasterData() {
  try {
    return JSON.parse(localStorage.getItem('hrbp_cert_master_data') || '{}');
  } catch {
    return {};
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve company name + address for a given employee + language.
 *
 * @param {object} emp - Employee object with at least `.company` (or `.company_name`).
 * @param {boolean} th - If true, prefer Thai language; otherwise English.
 * @returns {{ coNameTh: string, coNameEn: string, address: string, addressTh: string, addressEn: string }}
 */
export function resolveCompanyAddress(emp, th = true) {
  const compName = emp?.company || emp?.company_name || '';
  const mapped = COMPANY_MAP[compName] || { th: compName, en: compName };
  let coNameTh = mapped.th;
  let coNameEn = mapped.en;
  let caTh = '';
  let caEn = '';

  // Try master data first
  try {
    const md = loadCertMasterData();
    if (md.companies?.length) {
      const foundCo = findMasterCompany(md.companies, compName);
      if (foundCo) {
        if (foundCo.name) coNameTh = foundCo.name;
        if (foundCo.name_en) coNameEn = foundCo.name_en;
        const addr = md.addresses?.find(a => a.company_id === foundCo.id);
        if (addr) {
          caTh = addr.address || '';
          caEn = addr.address_en || addr.address || '';
        }
      }
    }
  } catch (_) { /* silent */ }

  // Fallback addresses if master data not found
  if (!caTh) {
    const fallback = FALLBACK_ADDRESSES.find(fb => fb.match(compName));
    const fb = fallback || DEFAULT_FALLBACK;
    caTh = fb.th;
    caEn = fb.en;
  }

  return {
    coNameTh,
    coNameEn,
    address: th ? caTh : caEn,
    addressTh: caTh,
    addressEn: caEn,
  };
}

/**
 * Asynchronous version that first tries API then falls back to localStorage + hardcoded.
 * Used by the templates.js rendering path which already calls getCertMasterData.
 *
 * @param {object} data - Data object with company_name and optionally company_address/company_address_en.
 * @param {function} apiLoader - Optional async function to fetch fresh master data (e.g. getCertMasterData).
 * @returns {Promise<object>} Enriched data with company_name/company_address resolved.
 */
export async function enrichCertWithCompanyAddress(data, apiLoader = null) {
  if (!data) return data;
  const compName = data.company_name || '';

  // If address already set in data, use it as-is
  let coNameTh = data.company_name || compName;
  let coNameEn = data.company_name_en || data.company_name || compName;
  let caTh = data.company_address || '';
  let caEn = data.company_address_en || '';

  // Try API loader if provided
  let masterData = {};
  if (apiLoader) {
    try {
      const res = await apiLoader();
      masterData = res?.data || res || {};
    } catch (_) { /* silent */ }
  }
  if (!masterData.companies?.length) {
    masterData = loadCertMasterData();
  }

  const searchNames = [compName, COMPANY_MAP[compName]?.th, COMPANY_MAP[compName]?.en].filter(Boolean);
  let foundCo = null;
  for (const name of searchNames) {
    foundCo = findMasterCompany(masterData.companies, name);
    if (foundCo) break;
  }

  if (foundCo) {
    if (foundCo.name) coNameTh = foundCo.name;
    if (foundCo.name_en) coNameEn = foundCo.name_en;
    const addr = masterData.addresses?.find(a => a.company_id === foundCo.id);
    if (addr) {
      caTh = addr.address || '';
      caEn = addr.address_en || addr.address || '';
    }
  }

  // Fallback addresses if still empty
  if (!caTh) {
    const fallback = FALLBACK_ADDRESSES.find(fb => fb.match(compName));
    const fb = fallback || DEFAULT_FALLBACK;
    caTh = caTh || fb.th;
    caEn = caEn || fb.en;
  }

  return {
    ...data,
    company_name: coNameTh,
    company_name_en: coNameEn,
    company_address: caTh,
    company_address_en: caEn,
  };
}

/**
 * Direct access to the COMPANY_MAP for places that need just the name lookup.
 */
export function getCompanyMap() {
  return COMPANY_MAP;
}

/**
 * Direct access to fallback addresses for admin settings / manual display.
 */
export function getFallbackAddresses() {
  return { fallbacks: FALLBACK_ADDRESSES, default: DEFAULT_FALLBACK };
}