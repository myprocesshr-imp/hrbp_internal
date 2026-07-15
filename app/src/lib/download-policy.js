/**
 * Certificate download window policy — how long employees may download after HR issues.
 */
import { getLang } from './i18n.js';

export const APP_SETTINGS_KEY = 'hrbp_app_settings';
export const REQUESTS_STORAGE_KEY = 'hrbp_employee_requests';
export const DEFAULT_CERT_DOWNLOAD_DAYS = 30;
export const MIN_CERT_DOWNLOAD_DAYS = 1;
export const MAX_CERT_DOWNLOAD_DAYS = 365;

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(APP_SETTINGS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function getCertDownloadDays() {
  const raw = readSettings().cert_download_days;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return DEFAULT_CERT_DOWNLOAD_DAYS;
  return Math.min(MAX_CERT_DOWNLOAD_DAYS, Math.max(MIN_CERT_DOWNLOAD_DAYS, n));
}

export function setCertDownloadDays(days) {
  const n = parseInt(days, 10);
  if (!Number.isFinite(n) || n < MIN_CERT_DOWNLOAD_DAYS || n > MAX_CERT_DOWNLOAD_DAYS) {
    throw new Error('invalid_download_days');
  }
  return writeSettings({ cert_download_days: n });
}

export function isoToday() {
  const d = new Date();
  return toIsoDate(d);
}

export function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

export function addCalendarDays(isoDate, days) {
  const base = parseIsoDate(isoDate) || new Date();
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return toIsoDate(result);
}

export function parseThaiIssuedDate(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const long = trimmed.match(/^(\d{1,2})\s+([^\s]+)\s+(?:พ\.ศ\.|พศ\.?|ค\.ศ\.|คศ\.?)?\s*(\d{4})/);
  if (long) {
    const day = parseInt(long[1], 10);
    const monthName = long[2].replace(/\.$/, '');
    let year = parseInt(long[3], 10);
    if (year > 2400) year -= 543;
    let monthIdx = THAI_MONTHS_FULL.findIndex(m => m === monthName || m.startsWith(monthName));
    if (monthIdx < 0) {
      monthIdx = THAI_MONTHS_SHORT.findIndex(m => m === monthName || m.startsWith(monthName));
    }
    if (monthIdx >= 0 && day >= 1 && day <= 31) {
      return toIsoDate(new Date(year, monthIdx, day));
    }
  }
  return null;
}

export function resolveIssuedAtIso(req = {}) {
  if (req.cert_issued_at) return req.cert_issued_at;
  const parsed = parseThaiIssuedDate(req.cert_issued_date);
  if (parsed) return parsed;
  return isoToday();
}

export function computeDownloadUntil(issuedAtIso, days = getCertDownloadDays()) {
  return addCalendarDays(issuedAtIso, days);
}

export function isDownloadWindowOpen(req = {}) {
  if (!req.cert_ready) return false;
  const until = req.cert_download_until || computeDownloadUntil(resolveIssuedAtIso(req));
  const today = isoToday();
  return today <= until;
}

export function enrichRequestDownloadAccess(req = {}) {
  if (!req.cert_ready) {
    return { ...req, can_download: false, canDownload: false };
  }

  const enriched = { ...req };
  if (!enriched.cert_issued_at) {
    enriched.cert_issued_at = resolveIssuedAtIso(enriched);
  }
  if (!enriched.cert_download_until) {
    enriched.cert_download_until = computeDownloadUntil(enriched.cert_issued_at);
  }

  const active = isDownloadWindowOpen(enriched);
  enriched.can_download = active;
  enriched.canDownload = active;
  return enriched;
}

export function stampCertDownloadFields(req = {}, issuedAtIso = isoToday()) {
  const until = computeDownloadUntil(issuedAtIso);
  return {
    ...req,
    cert_issued_at: issuedAtIso,
    cert_download_until: until,
    cert_ready: true,
    can_download: true,
    canDownload: true,
  };
}

export function syncStoredRequestsDownloadAccess() {
  let raw = [];
  try {
    raw = JSON.parse(localStorage.getItem(REQUESTS_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }

  let changed = false;
  const updated = raw.map(r => {
    if (!r.cert_ready) return r;
    const next = enrichRequestDownloadAccess(r);
    const before = JSON.stringify({
      cert_issued_at: r.cert_issued_at,
      cert_download_until: r.cert_download_until,
      can_download: r.can_download,
      canDownload: r.canDownload,
    });
    const after = JSON.stringify({
      cert_issued_at: next.cert_issued_at,
      cert_download_until: next.cert_download_until,
      can_download: next.can_download,
      canDownload: next.canDownload,
    });
    if (before !== after) changed = true;
    return next;
  });

  if (changed) {
    localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(updated));
  }
  return updated;
}

export function formatIsoDateDisplay(isoDate) {
  const d = parseIsoDate(isoDate);
  if (!d) return isoDate || '';
  const lang = getLang();
  const months = lang === 'en' ? THAI_MONTHS_SHORT.map((_, i) =>
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]
  ) : THAI_MONTHS_SHORT;
  const year = lang === 'en' ? d.getFullYear() : d.getFullYear() + 543;
  return `${d.getDate()} ${months[d.getMonth()]} ${year}`;
}