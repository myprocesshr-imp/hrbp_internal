/**
 * HRMS field mapping helpers
 * Maps SexID, FNameE, LNameE from HRMS employee profile.
 */

export function mapHrmsProfileFields(profile = {}) {
  return {
    sex_id: profile.SexID ?? profile.sex_id ?? '',
    fname_e: (profile.FNameE ?? profile.fname_e ?? '').trim(),
    lname_e: (profile.LNameE ?? profile.lname_e ?? '').trim(),
  };
}

export function buildEnglishName(source = {}) {
  const first = source.FNameE ?? source.fname_e ?? '';
  const last = source.LNameE ?? source.lname_e ?? '';
  return [first, last].filter(Boolean).join(' ').trim();
}

export function getGenderPronouns(sexId) {
  const id = String(sexId ?? '').trim().toLowerCase();
  if (id === '1' || id === 'm' || id === 'male' || id === 'ชาย') {
    return { subject: 'He', possessive: 'His', object: 'him', reflexive: 'his' };
  }
  if (id === '2' || id === 'f' || id === 'female' || id === 'หญิง') {
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
  const id = String(sexId ?? '').trim().toLowerCase();
  if (id === '1' || id === 'm' || id === 'male' || id === 'ชาย') {
    return lang === 'en' ? 'Male' : 'ชาย';
  }
  if (id === '2' || id === 'f' || id === 'female' || id === 'หญิง') {
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