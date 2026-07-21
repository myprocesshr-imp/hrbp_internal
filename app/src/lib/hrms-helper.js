/**
 * HRMS field mapping helpers
 * Maps SexID, FNameE, LNameE from HRMS employee profile.
 */
import { getHrmsEmployee } from './api.js';

/**
 * Normalize an HRMS sex value to the internal codes used across the app
 * ('1' = male, '2' = female). Accepts numeric/string codes and word forms.
 */
function normalizeSexId(v) {
  if (v == null) return '';
  const s = String(v).trim().toLowerCase();
  if (['1', 'm', 'male', 'ชาย'].includes(s)) return '1';
  if (['2', 'f', 'female', 'หญิง'].includes(s)) return '2';
  return s; // keep as-is if it doesn't match any known form
}

export function mapHrmsProfileFields(profile = {}) {
  // HRMS returns the sex value under varying keys; try the common ones.
  const rawSex = profile.SexID ?? profile.sex_id ?? profile.Sex
    ?? profile.sex ?? profile.Gender ?? profile.gender ?? '';
  // Also peek inside a nested profile object if the API nests it.
  const nested = profile.profile || profile.employee || {};
  const rawSexNested = nested.SexID ?? nested.sex_id ?? nested.Sex
    ?? nested.sex ?? nested.Gender ?? nested.gender ?? '';
  return {
    sex_id: normalizeSexId(rawSex || rawSexNested),
    fname_e: (profile.FNameE ?? profile.fname_e ?? '').trim(),
    lname_e: (profile.LNameE ?? profile.lname_e ?? '').trim(),
  };
}

/**
 * Enrich a user object with the real English-name fields from HRMS.
 *
 * Older accounts that logged in before the English-name columns (fname_e,
 * lname_e, sex_id) existed never received those fields, so the UI falls back
 * to the Thai name. This pulls the authoritative values from HRMS and returns
 * an updated user object (with full_name_en derived from fname_e/lname_e).
 *
 * @param {object} user - Current user; must carry a non-empty `emp_id`.
 * @returns {Promise<object|null>} enriched user, or null if HRMS is unavailable
 *          or the user has no emp_id / already up-to-date.
 */
export async function enrichUserFromHrms(user) {
  if (!user || !user.emp_id) return null;

  let profile = null;
  try {
    const res = await getHrmsEmployee(user.emp_id);
    profile = res?.data?.employee || null;
  } catch (err) {
    console.warn('[enrichUserFromHrms] HRMS fetch failed:', err);
    return null;
  }
  if (!profile) return null;

  const fields = mapHrmsProfileFields(profile);
  const hasNewData = fields.fname_e || fields.lname_e || fields.sex_id;
  if (!hasNewData) return null;

  // Only treat as "missing" when the stored value is empty, so we don't
  // clobber data that was already correctly populated.
  const needsFname = !user.fname_e && fields.fname_e;
  const needsLname = !user.lname_e && fields.lname_e;
  const needsSex = !user.sex_id && fields.sex_id;
  if (!needsFname && !needsLname && !needsSex) return null;

  const enriched = {
    ...user,
    fname_e: user.fname_e || fields.fname_e,
    lname_e: user.lname_e || fields.lname_e,
    sex_id: user.sex_id || fields.sex_id,
  };
  enriched.full_name_en = buildEnglishName(enriched) || user.full_name_en || '';
  return enriched;
}

/**
 * Persist English-name fields into the shared `hrbp_mock_users` store (the
 * source for both the admin-users table via getUsers() and the Certificate
 * Builder HR-staff list via loadHRStaff()). Without this, enrichment written
 * only to localStorage `hrbp_user` never reaches the views that actually
 * render the names.
 *
 * @param {object} enriched - User with fname_e/lname_e/sex_id/full_name_en.
 * @returns {object|null} the matched record (with fields applied) or null.
 */
export function persistEnglishNameToMockUsers(enriched) {
  if (!enriched) return null;
  try {
    const KEY = 'hrbp_mock_users';
    const users = JSON.parse(localStorage.getItem(KEY) || '[]');
    const idx = users.findIndex(u =>
      (enriched.id != null && String(u.id) === String(enriched.id)) ||
      (enriched.username && u.username === enriched.username) ||
      (enriched.emp_id && u.emp_id === enriched.emp_id)
    );
    if (idx === -1) return null;
    users[idx] = {
      ...users[idx],
      fname_e: enriched.fname_e || users[idx].fname_e || '',
      lname_e: enriched.lname_e || users[idx].lname_e || '',
      sex_id: enriched.sex_id || users[idx].sex_id || '',
      full_name_en: enriched.full_name_en || users[idx].full_name_en || '',
    };
    localStorage.setItem(KEY, JSON.stringify(users));
    return users[idx];
  } catch (_) {
    return null;
  }
}



export function buildEnglishName(source = {}) {
  const first = source.FNameE ?? source.fname_e ?? '';
  const last = source.LNameE ?? source.lname_e ?? '';
  return [first, last].filter(Boolean).join(' ').trim();
}

export function getGenderPronouns(sexId) {
  // Parse numerically so '1'/'1.0'/1 (male) and '2'/'2.0'/2 (female) all match,
  // regardless of whether the stored value came through as a float-like string.
  const n = parseFloat(sexId);
  if (n === 1) {
    return { subject: 'He', possessive: 'His', object: 'him', reflexive: 'his' };
  }
  if (n === 2) {
    return { subject: 'She', possessive: 'Her', object: 'her', reflexive: 'her' };
  }
  // Fall back to word forms (m/male/ชาย, f/female/หญิง)
  const id = String(sexId ?? '').trim().toLowerCase();
  if (['m', 'male', 'ชาย'].includes(id)) {
    return { subject: 'He', possessive: 'His', object: 'him', reflexive: 'his' };
  }
  if (['f', 'female', 'หญิง'].includes(id)) {
    return { subject: 'She', possessive: 'Her', object: 'her', reflexive: 'her' };
  }
  return { subject: 'She/He', possessive: 'Her/His', object: 'her/him', reflexive: 'her/his' };
}

/** Sentence-start and mid-sentence pronoun placeholders for certificate templates */
export function genderPronounPlaceholders(sexId) {
  const p = getGenderPronouns(sexId);
  return {
    gender_subject: p.subject,
    gender_possessive: p.possessive,
    gender_object: p.object,
    gender_reflexive: p.reflexive,
    gender_subject_lc: p.subject.toLowerCase(),
    gender_possessive_lc: p.possessive.toLowerCase(),
    gender_object_lc: p.object.toLowerCase(),
    gender_reflexive_lc: p.reflexive.toLowerCase(),
  };
}

export function getSexLabel(sexId, lang = 'th') {
  // Parse numerically so '1'/'1.0'/1 (male) and '2'/'2.0'/2 (female) all match.
  const n = parseFloat(sexId);
  if (n === 1) {
    return lang === 'en' ? 'Male' : 'ชาย';
  }
  if (n === 2) {
    return lang === 'en' ? 'Female' : 'หญิง';
  }
  const id = String(sexId ?? '').trim().toLowerCase();
  if (['m', 'male', 'ชาย'].includes(id)) {
    return lang === 'en' ? 'Male' : 'ชาย';
  }
  if (['f', 'female', 'หญิง'].includes(id)) {
    return lang === 'en' ? 'Female' : 'หญิง';
  }
  return lang === 'en' ? '-' : '-';
}

const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function englishOrdinalSuffix(day) {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function englishOrdinal(day) {
  return `${day}<sup>${englishOrdinalSuffix(day)}</sup>`;
}

function formatEnglishDateFromDate(date) {
  return `${EN_MONTHS[date.getMonth()]} ${englishOrdinal(date.getDate())}, ${date.getFullYear()}`;
}

export function formatEnglishDateFull(dateStr) {
  if (!dateStr) return '';
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return dateStr;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return formatEnglishDateFromDate(d);
}

export function todayEnglishFull() {
  return formatEnglishDateFromDate(new Date());
}

/** Thai local phone → international display (+66 …) */
export function formatPhoneInternational(phone) {
  if (!phone || phone === '-') return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  let national = digits;
  if (national.startsWith('66') && national.length >= 10) national = national.slice(2);
  if (national.startsWith('0')) national = national.slice(1);
  if (!national) return '';

  if (national.length === 9) {
    return `+66 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
  }
  if (national.length === 8) {
    return `+66 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
  }
  return `+66 ${national}`;
}

/** Detect published templates that render English certificates */
/**
 * Check if a template is English.
 * Priority:
 *   1. template.language field (explicit: 'en' → English, 'th' → Thai, 'both' → English)
 *   2. Legacy heuristics (ID/name patterns) for backward compatibility
 */
export function isEnglishTemplate(tmpl) {
  if (!tmpl) return false;

  // Explicit language field takes priority
  const lang = (tmpl.language || '').toLowerCase();
  if (lang === 'en') return true;
  if (lang === 'th') return false;
  // 'both' → prefers English for display purposes

  // Legacy heuristic fallback (for templates without language field)
  const id = String(tmpl.id || '').toLowerCase();
  const name = String(tmpl.name || '');
  if (id.endsWith('-en') || id.includes('visa-abroad') || id.includes('-eng')) return true;
  if (/\(eng\)|\(english\)/i.test(name)) return true;
  if (name.includes('Eng')) return true;
  return false;
}

/** Map user/request fields for Thai or English certificate rendering */
export function buildEmployeeDisplayFields(source = {}, useEnglish = false) {
  const fullNameTh = source.full_name || source.nameTH || '______________';
  const fullNameEn = source.full_name_en || buildEnglishName(source) || fullNameTh;
  const position = source.position || source.posTH || source.posEN || '______________';
  const department = source.department || source.deptTH || source.deptEN || '______________';
  const startRaw = source.start_date || '';
  const startTH = source.startTH || '';
  const startEN = source.startEN || formatEnglishDateFull(startRaw);

  if (useEnglish) {
    return {
      full_name: fullNameEn,
      full_name_en: fullNameEn,
      position: source.position_en || position,
      department: source.department_en || department,
      start_date: startEN || startRaw || '______________',
      start_date_en: startEN || startRaw || '______________',
    };
  }

  return {
    full_name: fullNameTh,
    full_name_en: fullNameEn,
    position,
    department,
    start_date: startTH || startRaw || '______________',
    start_date_en: startEN || startRaw || '______________',
  };
}