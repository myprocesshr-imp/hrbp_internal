/**
 * Certificate PDF Template engine
 * Generates HTML for employment certificates that print as PDF.
 */
import { t } from './i18n.js';
import { getTemplates, getCertMasterData } from './api.js';
import { isoToday, stampCertDownloadFields } from './download-policy.js';
import {
  buildEmployeeDisplayFields,
  buildEnglishName,
  formatEnglishDateFull,
  formatPhoneInternational,
  genderPronounPlaceholders,
  isEnglishTemplate,
  todayEnglishFull,
} from './hrms-helper.js';

const MOCK_DB_KEY_CERT_MASTER = 'hrbp_cert_master_data';
const CERT_COUNTER_KEY = 'hrbp_cert_counter';

const COMPANY_MAP = {
  'Mango': { th: 'บริษัท แมงโก้ จำกัด', en: 'Mango Company Limited' },
  'Corporate': { th: 'บริษัท คอร์ปอเรท คลาริตี้ จำกัด', en: 'Corporate Clarity Company Limited' },
  'HRBP Group': { th: 'บริษัท เอชอาร์บีพี กรุ๊ป จำกัด', en: 'HRBP Group Company Limited' },
};

function findMasterCompany(companies, companyName) {
  if (!companyName || !companies?.length) return null;
  const q = companyName.trim().toLowerCase();
  return companies.find(c => {
    const th = (c.name || '').toLowerCase();
    const en = (c.name_en || '').toLowerCase();
    return (th && (q.includes(th) || th.includes(q))) || (en && (q.includes(en) || en.includes(q)));
  }) || null;
}

async function loadCertMasterData() {
  try {
    const res = await getCertMasterData();
    if (res?.data && (res.data.companies || res.data.addresses)) return res.data;
  } catch (_) {}
  try {
    return JSON.parse(localStorage.getItem(MOCK_DB_KEY_CERT_MASTER) || '{}');
  } catch (_) {
    return {};
  }
}

async function enrichCertDataWithMasterData(data) {
  if (!data) return data;
  const compName = data.company_name || '';
  const mapped = COMPANY_MAP[compName];
  let coNameTh = mapped?.th || compName;
  let coNameEn = mapped?.en || data.company_name_en || compName;
  let caTh = data.company_address || '';
  let caEn = data.company_address_en || '';

  const md = await loadCertMasterData();
  const searchNames = [compName, mapped?.th, mapped?.en].filter(Boolean);
  let foundCo = null;
  for (const name of searchNames) {
    foundCo = findMasterCompany(md.companies, name);
    if (foundCo) break;
  }

  if (foundCo) {
    if (foundCo.name) coNameTh = foundCo.name;
    if (foundCo.name_en) coNameEn = foundCo.name_en;
    const addr = md.addresses?.find(a => a.company_id === foundCo.id);
    if (addr) {
      caTh = addr.address || '';
      caEn = addr.address_en || addr.address || '';
    }
  }

  return {
    ...data,
    company_name: coNameTh,
    company_name_en: coNameEn,
    company_address: caTh,
    company_address_en: caEn,
  };
}

export function getBuddhistCertYear() {
  return new Date().getFullYear() + 543;
}

function getChristianCertYear() {
  return new Date().getFullYear();
}

export function formatCertNumber(counter, year) {
  return `${String(counter).padStart(4, '0')}/${year}`;
}

export function parseCertNumber(value) {
  if (!value) return null;
  const m = String(value).replace(/^HRBP\s*/i, '').trim().match(/(\d{1,4})\s*\/\s*(\d{4})/);
  if (!m) return null;
  return { counter: parseInt(m[1], 10), year: parseInt(m[2], 10) };
}

function isIssuedCertNumber(req) {
  if (!req?.cert_number || !req.cert_number_generated) return false;
  return !!parseCertNumber(req.cert_number);
}

export function getIssuedCertMaxCounter() {
  let max = 0;
  try {
    const reqs = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
    reqs.forEach(r => {
      if (!isIssuedCertNumber(r)) return;
      const parsed = parseCertNumber(r.cert_number);
      if (parsed) max = Math.max(max, parsed.counter);
    });
  } catch (_) {}
  return max;
}

export function syncCertCounter() {
  const max = getIssuedCertMaxCounter();
  localStorage.setItem(CERT_COUNTER_KEY, String(max));
  return max;
}

export function peekCertNumber(isEnglish = false) {
  const next = syncCertCounter() + 1;
  const year = isEnglish ? getChristianCertYear() : getBuddhistCertYear();
  return formatCertNumber(next, year);
}

export function allocateCertNumber(isEnglish = false) {
  const next = syncCertCounter() + 1;
  localStorage.setItem(CERT_COUNTER_KEY, String(next));
  const year = isEnglish ? getChristianCertYear() : getBuddhistCertYear();
  return formatCertNumber(next, year);
}

function getNextCertNumber(isEnglish = false) {
  return allocateCertNumber(isEnglish);
}
const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function formatThaiDateFull(dateStr) {
  if (!dateStr) return '-';
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return dateStr;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function formatThaiDateShort(dateStr) {
  if (!dateStr) return '-';
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return dateStr;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function todayThaiShort() {
  const d = new Date();
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function todayThaiFull() {
  const d = new Date();
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`;
}

/**
 * Generate a certificate HTML that can be printed as PDF.
 *
 * @param {object} data
 * @param {string} data.doc_type   - 'work' | 'salary' | 'visa'
 * @param {string} data.full_name  - Employee full name
 * @param {string} data.position   - Employee position
 * @param {string} data.department - Employee department
 * @param {string} data.company_name - Company name
 * @param {string} data.start_date - ISO start date
 * @param {string} data.purpose    - Purpose label (TH)
 * @param {string} data.purpose_value - purpose key
 * @param {string} data.salary     - 'yes' or 'no'
 * @param {string} data.language   - 'th' | 'en' | 'both'
 * @param {string} data.visa_country - for visa type
 * @param {string} data.institution - bank/study name
 * @param {string} data.cert_number - certificate number
 *
 * HR fills these (yellow fields):
 * @param {string} data.hr_purpose_detail - detailed purpose text
 * @param {string} data.hr_salary_amount  - salary amount text
 * @param {string} data.hr_signer_name    - signer name
 * @param {string} data.hr_signer_position - signer position
 */
async function getTemplateRecord(doc_type, language) {
  try {
    const res = await getTemplates();
    const list = res.data || res || [];
    const catMap = {
      'work': 'หนังสือรับรองการทำงาน',
      'salary': 'หนังสือรับรองเงินเดือน',
      'visa': 'หนังสือรับรองเพื่อทำวีซ่า',
      'abroad': 'หนังสือรับรองเพื่อทำวีซ่า',
    };
    const category = catMap[doc_type] || 'หนังสือรับรองการทำงาน';
    const wantEng = language === 'en' || language === 'both';
    const found = list.find(t =>
      t.category === category &&
      t.status === 'published' &&
      (wantEng ? isEnglishTemplate(t) : !isEnglishTemplate(t))
    );
    if (found) return found;
    // Fallback: match legacy name pattern
    const legacy = list.find(t =>
      t.category === category &&
      t.status === 'published' &&
      (wantEng ? t.name.includes('Eng') : t.name.includes('Thai'))
    );
    return legacy || null;
  } catch (e) {
    console.error('Failed to fetch template from D1:', e);
  }
  return null;
}

async function getTemplateHtml(doc_type, language) {
  const rec = await getTemplateRecord(doc_type, language);
  return rec?.content || null;
}

function parseTemplatePlaceholders(html, variables) {
  let rendered = html;
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(regex, variables[key] !== undefined ? variables[key] : '');
  });
  return rendered;
}

function escapeHtmlAttr(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function signatureImgHtml(sigSrc, alt = 'Signature') {
  if (!sigSrc) return '';
  const safeSrc = String(sigSrc).replace(/"/g, '&quot;');
  return `<img src="${safeSrc}" alt="${escapeHtmlAttr(alt)}" style="max-height:100%;max-width:100%;object-fit:contain;" />`;
}

function resolveSignerSignature(signerName) {
  if (!signerName) return '';
  // Convert an R2 storage key (e.g. "signatures/abc.png") to a proper API URL.
  // Data URLs and absolute URLs are returned as-is.
  const toImgUrl = (raw, userId) => {
    if (!raw) return '';
    if (raw.startsWith('data:') || raw.startsWith('http') || raw.startsWith('/')) return raw;
    // R2 key — serve through the signatures API endpoint
    return `/api/signatures/${userId}`;
  };
  try {
    const users = JSON.parse(localStorage.getItem('hrbp_mock_users') || '[]');
    // Prefer HR manager / admin role match
    const mgr = users.find(u =>
      u.full_name === signerName && ['hrmanager', 'admin'].includes(u.role)
    );
    if (mgr) {
      if (mgr.signature)     return toImgUrl(mgr.signature, mgr.id);
      if (mgr.signature_url) return toImgUrl(mgr.signature_url, mgr.id);
    }
    // Also check the hrbp_hr_signatures map (keyed by user ID)
    const sigs = JSON.parse(localStorage.getItem('hrbp_hr_signatures') || '{}');
    if (mgr?.id && sigs[mgr.id]) return toImgUrl(sigs[mgr.id], mgr.id);

    // Fallback: any user matching the name (any role)
    const byName = users.find(u => u.full_name === signerName);
    if (byName) {
      if (byName.signature)     return toImgUrl(byName.signature, byName.id);
      if (byName.signature_url) return toImgUrl(byName.signature_url, byName.id);
      if (byName.id && sigs[byName.id]) return toImgUrl(sigs[byName.id], byName.id);
    }
  } catch (_) {}
  return '';
}

const CERT_PRINT_SINGLE_PAGE_CSS = `<style id="cb-print-single-page">
@page { size: A4; margin: 0; }
html, body { margin: 0 !important; padding: 0 !important; width: 210mm !important; height: 297mm !important; overflow: hidden !important; }
.cert-page, .page {
  width: 210mm !important;
  height: 297mm !important;
  min-height: 297mm !important;
  max-height: 297mm !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
  page-break-inside: avoid !important;
  page-break-after: avoid !important;
  padding: 20mm 25mm 14mm !important;
  display: flex !important;
  flex-direction: column !important;
}
.body-text, .body { flex: 0 0 auto !important; min-height: 0 !important; margin-bottom: 0 !important; }
.signature-area, .sig-area { margin-top: 8mm !important; margin-bottom: 0 !important; padding-top: 0 !important; flex-shrink: 0 !important; }
.footer, .cb-cert-footer, .ftr { margin-top: auto !important; flex-shrink: 0 !important; page-break-inside: avoid !important; }
.doc-title { margin-top: 6mm !important; margin-bottom: 8mm !important; }
.purpose-line { margin-top: 6mm !important; }
</style>`;

const CERT_FINAL_OUTPUT_CSS = `<style id="cb-final-output">
#cb-rmk-text, #cb-issue-date, #cb-mgr-name, #cb-mgr-display, #cb-mgr-pos,
#cb-header-hr-phone, #cb-off-phone, #cb-off-email, .cb-off-print-name,
#cb-emp-salary, input#cb-emp-salary {
  color: #1a1a1a !important;
  border: none !important;
  border-bottom: none !important;
  background: transparent !important;
  outline: none !important;
  box-shadow: none !important;
  text-decoration: none !important;
  cursor: default !important;
}
#cb-mgr-display, #cb-mgr-name { font-weight: 700 !important; }
.cb-off-select-visible { color: #1a1a1a !important; border: none !important; }
</style>`;

/**
 * Strip builder edit chrome (blue dashed fields, selects) for print / employee download.
 */
export function finalizeCertificateOutputHtml(html, { offName = '', sigSrc = '' } = {}) {
  let out = html;
  const safeName = escapeHtmlAttr(offName);

  out = out.replace(
    /<select[^>]*\bid="cb-off-select"[^>]*>[\s\S]*?<\/select>/gi,
    `<span class="cb-off-print-name" style="font-weight:700;color:#1a1a1a;">${safeName}</span>`
  );
  out = out.replace(
    /<select[^>]*\bid="cb-outer-off-select"[^>]*>[\s\S]*?<\/select>/gi,
    `<span class="cb-off-print-name" style="font-weight:700;color:#1a1a1a;">${safeName}</span>`
  );
  out = out.replace(/<select[^>]*\bid="cb-mgr-select"[^>]*>[\s\S]*?<\/select>/gi, '');
  out = out.replace(/<select[^>]*\bid="cb-rmk-select"[^>]*>[\s\S]*?<\/select>/gi, '');
  out = out.replace(/<select[^>]*\bid="cb-header-hr-select"[^>]*>[\s\S]*?<\/select>/gi, '');

  if (sigSrc) {
    const sigHtml = signatureImgHtml(sigSrc);
    out = out.replace(
      /(<div[^>]*\bid="cb-sig-box"[^>]*>)([\s\S]*?)(<\/div>)/i,
      `$1${sigHtml}$3`
    );
  }

  out = out.replace(/\scontenteditable="true"/gi, '');
  out = out.replace(/\stitle="[^"]*(?:คลิก|Click|เลือก|Select|แก้ไข|edit)[^"]*"/gi, '');

  const editIds = 'cb-rmk-text|cb-issue-date|cb-mgr-display|cb-header-hr-phone|cb-emp-salary|cb-mgr-name';
  out = out.replace(
    new RegExp(`(<[a-z][a-z0-9]*[^>]*\\bid="(?:${editIds})"[^>]*)\\sstyle="[^"]*"`, 'gi'),
    '$1'
  );

  out = out.replace(
    /<div[^>]*\bid="cb-mgr-display"[^>]*>([\s\S]*?)<\/div>/gi,
    (_match, inner) => {
      const nameMatch = inner.match(/id="cb-mgr-name"[^>]*>([\s\S]*?)<\//i);
      const name = nameMatch ? nameMatch[1].trim() : inner.replace(/<[^>]+>/g, '').replace(/[()&nbsp;\s]/g, ' ').trim();
      return `<div style="font-size:16pt;font-weight:700;color:#1a1a1a;">(&nbsp;${name}&nbsp;)</div>`;
    }
  );

  out = out.replace(
    /<input[^>]*\bid="cb-emp-salary"[^>]*value="([^"]*)"[^>]*\/?>/gi,
    '<span style="font-weight:700;color:#1a1a1a;">$1</span>'
  );

  out = out.replace(/style="([^"]*)"/gi, (match, styles) => {
    if (!/1a73e8|dashed|e8f0fe/i.test(styles)) return match;
    let cleaned = styles
      .replace(/border[^;]*dashed[^;]*;?/gi, '')
      .replace(/border-bottom[^;]*;?/gi, '')
      .replace(/color\s*:\s*#?1a73e8[^;]*;?/gi, 'color:#1a1a1a;')
      .replace(/background(?:-color)?\s*:\s*#?e8f0fe[^;]*;?/gi, 'background:transparent;')
      .replace(/cursor\s*:\s*(?:pointer|text)[^;]*;?/gi, '')
      .replace(/outline[^;]*;?/gi, '')
      .replace(/;\s*;/g, ';')
      .trim();
    if (cleaned.endsWith(';')) cleaned = cleaned.slice(0, -1);
    return cleaned ? `style="${cleaned}"` : '';
  });

  const injectStyles = `${CERT_PRINT_SINGLE_PAGE_CSS}${CERT_FINAL_OUTPUT_CSS}`;
  if (!out.includes('cb-final-output')) {
    if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `${injectStyles}</head>`);
    } else if (/<body[^>]*>/i.test(out)) {
      out = out.replace(/<body([^>]*)>/i, `<body$1>${injectStyles}`);
    } else {
      out = injectStyles + out;
    }
  }

  return out;
}

function buildCertVariables(data, templateRecord = null) {
  const useEnglish = isEnglishTemplate(templateRecord) || data.language === 'en';
  const empFields = buildEmployeeDisplayFields(data, useEnglish);
  const companyNameEn = data.company_name_en || data.company_name || '______________';
  const abroadStart = data.abroad_start_date || '';
  const abroadEnd = data.abroad_end_date || '';

  return {
    company_name: useEnglish ? companyNameEn : (data.company_name || '______________'),
    company_name_en: companyNameEn,
    company_address: useEnglish
      ? (data.company_address_en || data.company_address || '______________')
      : (data.company_address || '______________'),
    company_address_en: data.company_address_en || data.company_address || '______________',
    cert_number: data.cert_number || `____/${new Date().getFullYear() + 543}`,
    full_name: empFields.full_name,
    full_name_en: empFields.full_name_en,
    ...genderPronounPlaceholders(data.sex_id),
    emp_id: data.empCode || data.emp_id || '______________',
    position: empFields.position,
    department: empFields.department,
    start_date: useEnglish ? empFields.start_date_en : formatThaiDateFull(data.start_date),
    start_date_en: empFields.start_date_en || formatEnglishDateFull(data.start_date) || '______________',
    purpose: data.hr_purpose_detail || data.purpose || '________________________________',
    salary_amount: data.hr_salary_amount || '______________',
    issue_date: useEnglish ? todayEnglishFull() : todayThaiFull(),
    issue_date_en: todayEnglishFull(),
    hr_signer_name: data.hr_signer_name || '______________',
    hr_signer_position: data.hr_signer_position || 'HR Department Manager',
    hr_signer_phone_intl: formatPhoneInternational(data.hr_signer_phone || ''),
    hr_officer_name: data.hr_officer_name || 'วิภาดา รักษาธรรม',
    hr_officer_phone: data.hr_officer_phone || '081-234-5678',
    hr_officer_phone_intl: formatPhoneInternational(data.hr_officer_phone || '081-234-5678'),
    hr_officer_email: data.hr_officer_email || 'wipada.r@company.com',
    visa_country: data.visa_country || data.abroad_destination || '______________',
    abroad_start_date_en: formatEnglishDateFull(abroadStart) || '______________',
    abroad_end_date_en: formatEnglishDateFull(abroadEnd) || '______________',
    hr_signer_signature: signatureImgHtml(
      resolveSignerSignature(data.hr_signer_name),
      data.hr_signer_name || 'Signature'
    ),
  };
}

export async function generateCertificateHTML(data) {
  const enriched = await enrichCertDataWithMasterData(data);
  const templateRecord = await getTemplateRecord(enriched.doc_type, enriched.language);
  const templateHtml = templateRecord?.content;
  if (!templateHtml) {
    return `<html><body><div style="padding: 20px; font-family: sans-serif; color: red; text-align: center;">ไม่พบเทมเพลตสำหรับเอกสารประเภทนี้ในระบบ กรุณาตรวจสอบการตั้งค่าเทมเพลต</div></body></html>`;
  }

  const variables = buildCertVariables(enriched, templateRecord);
  let html = parseTemplatePlaceholders(templateHtml, variables);
  html = finalizeCertificateOutputHtml(html, {
    offName: variables.hr_officer_name,
    sigSrc: resolveSignerSignature(enriched.hr_signer_name),
  });
  return html;
}

/**
 * Snapshot of certificate content at HR Save — used for cross-check vs employee download.
 */
export function buildCertIssueSnapshot(fields = {}) {
  return {
    ...fields,
    saved_at: new Date().toISOString(),
  };
}

export function buildCertDataFromRequest(rawReq, user) {
  const docTypeMap = {
    'ใบรับรองการทำงาน': 'work',
    'ใบรับรองเงินเดือน': 'salary',
    'ใบรับรองเพื่อทำวีซ่า': 'visa',
    'ใบรับรองกรณีส่งพนักงานไปทำงานต่างประเทศ': 'abroad',
  };
  const doc_type = rawReq.doc_type || docTypeMap[rawReq.type] || 'work';
  const snap = rawReq.cert_issue_snapshot || null;

  const requestHrName = rawReq.hr_officer?.name || '';
  const requestHrId   = rawReq.hr_officer?.emp_id || '';

  // Issued fields (HR Save) take priority over employee's original HRBP selection
  const issuedOffName  = snap?.hr_officer_name  || rawReq.hr_officer_name  || '';
  const issuedOffPhone = snap?.hr_officer_phone  || rawReq.hr_officer_phone  || '';
  const issuedOffEmail = snap?.hr_officer_email  || rawReq.hr_officer_email  || '';

  const signerName = snap?.hr_signer_name || rawReq.hr_signer_name || '';
  let requestHrPhone = '';
  let requestHrEmail = '';
  let signerPhone = snap?.hr_signer_phone || rawReq.hr_signer_phone || '';

  if (!issuedOffPhone || !issuedOffEmail || !signerPhone) {
    try {
      const users = JSON.parse(localStorage.getItem('hrbp_mock_users') || '[]');
      if (!issuedOffPhone || !issuedOffEmail) {
        const lookupName = issuedOffName || requestHrName;
        const lookupId = snap?.hr_officer_id || rawReq.hr_officer_id || requestHrId;
        const foundHr = users.find(u =>
          (lookupId && String(u.id) === String(lookupId))
          || (lookupId && String(u.emp_id) === String(lookupId))
          || (lookupName && u.full_name === lookupName)
        );
        if (foundHr) {
          if (!issuedOffPhone) requestHrPhone = foundHr.phone || '';
          if (!issuedOffEmail) requestHrEmail = foundHr.email || '';
        }
      }
      if (!signerPhone && signerName) {
        const foundSigner = users.find(u => u.full_name === signerName && ['hrmanager', 'admin'].includes(u.role));
        if (foundSigner) signerPhone = foundSigner.phone || '';
      }
    } catch (_) {}
  }

  return {
    doc_type,
    hr_officer_name:  issuedOffName  || requestHrName || 'วิภาดา รักษาธรรม',
    hr_officer_phone: issuedOffPhone || requestHrPhone || '081-234-5678',
    hr_officer_email: issuedOffEmail || requestHrEmail || 'wipada.r@company.com',
    full_name:    snap?.employee_name || user?.full_name || rawReq.full_name || '______________',
    full_name_en: buildEnglishName(user) || user?.full_name || rawReq.full_name || '______________',
    sex_id:       user?.sex_id        || '',
    fname_e:      user?.fname_e       || '',
    lname_e:      user?.lname_e       || '',
    position:     user?.position     || '',
    department:   user?.department   || '',
    company_name: user?.company_name || '',
    start_date:   user?.start_date   || '',
    purpose:        rawReq.purpose       || '',
    purpose_value:  rawReq.purpose_value || '',
    salary:   rawReq.salary === 'ใช่' ? 'yes' : 'no',
    language: rawReq.language === 'ภาษาอังกฤษ' ? 'en' : rawReq.language === 'ทั้งสองภาษา' ? 'both' : 'th',
    cert_number:       snap?.cert_number       || rawReq.cert_number       || `____/${new Date().getFullYear() + 543}`,
    hr_purpose_detail: snap?.hr_purpose_detail || rawReq.hr_purpose_detail || '',
    hr_salary_amount:  snap?.hr_salary_amount  || rawReq.hr_salary_amount  || '',
    hr_signer_name:    signerName || '',
    hr_signer_position: snap?.hr_signer_position || rawReq.hr_signer_position || 'HR Department Manager',
    hr_signer_phone:   signerPhone,
    empCode: user?.emp_id || user?.empCode || rawReq.emp_id || rawReq.empCode || '______________',
    visa_country: rawReq.visa_country || rawReq.abroad_destination || '',
    abroad_destination: rawReq.abroad_destination || rawReq.visa_country || '',
    abroad_start_date: rawReq.abroad_start_date || '',
    abroad_end_date: rawReq.abroad_end_date || '',
  };
}

function buildCertificatePdfFilename(data = {}) {
  const num = String(data.cert_number || 'certificate')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_');
  const code = String(data.empCode || data.emp_id || '')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_');
  return `certificate-${num}${code ? `-${code}` : ''}.pdf`;
}

const A4_WIDTH_PX = Math.round(210 * (96 / 25.4));
const A4_HEIGHT_PX = Math.round(297 * (96 / 25.4));

/** html2canvas misplaces border-bottom on inline fields — use background underline instead. */
const CERT_PDF_CANVAS_CSS = `<style id="cert-pdf-canvas-fix">
.body-text .field,
.body .field,
.cert-page .field {
  border-bottom: none !important;
  background-image: linear-gradient(#1a1a1a, #1a1a1a) !important;
  background-size: 100% 1px !important;
  background-repeat: no-repeat !important;
  background-position: left bottom !important;
  padding: 0 4px 4px !important;
  line-height: 1.75 !important;
  vertical-align: baseline !important;
  display: inline-block !important;
  box-decoration-break: clone !important;
  -webkit-box-decoration-break: clone !important;
}
</style>`;

function injectPdfCanvasFixStyles(html) {
  if (html.includes('cert-pdf-canvas-fix')) return html;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${CERT_PDF_CANVAS_CSS}</head>`);
  return `${CERT_PDF_CANVAS_CSS}${html}`;
}

function applyPdfCanvasUnderlineFixes(root) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('.field').forEach(el => {
    el.style.borderBottom = 'none';
    el.style.backgroundImage = 'linear-gradient(#1a1a1a, #1a1a1a)';
    el.style.backgroundSize = '100% 1px';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = 'left bottom';
    el.style.padding = '0 4px 4px';
    el.style.lineHeight = '1.75';
    el.style.verticalAlign = 'baseline';
    el.style.display = 'inline-block';
    el.style.boxDecorationBreak = 'clone';
  });
}

async function waitForCertificateRender(doc) {
  const imgs = Array.from(doc?.images || []);
  await Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = img.onerror = resolve;
    });
  }));
  if (doc?.fonts?.ready) {
    try { await doc.fonts.ready; } catch (_) {}
  }
  await new Promise(resolve => setTimeout(resolve, 350));
}

async function mountCertificateRenderFrame(html) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${A4_WIDTH_PX}px`,
    `height:${A4_HEIGHT_PX}px`,
    'border:0',
    'opacity:0.01',
    'pointer-events:none',
    'z-index:-1',
  ].join(';');
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win.document;
  doc.open();
  doc.write(html);
  doc.close();

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('render_timeout')), 15000);
    const done = () => {
      clearTimeout(timeout);
      resolve();
    };
    if (doc.readyState === 'complete') done();
    else win.addEventListener('load', done, { once: true });
  });

  await waitForCertificateRender(doc);
  return { iframe, doc };
}

/**
 * Generate and download a PDF file directly (no print dialog).
 */
export async function downloadCertificatePdf(data, { filename } = {}) {
  const html = injectPdfCanvasFixStyles(await generateCertificateHTML(data));
  const pdfName = filename || buildCertificatePdfFilename(data);
  const { iframe, doc } = await mountCertificateRenderFrame(html);

  try {
    const element = doc.querySelector('.cert-page') || doc.querySelector('.page');
    if (!element) throw new Error('cert_element_missing');

    applyPdfCanvasUnderlineFixes(doc);

    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: element.offsetWidth,
      height: element.offsetHeight,
      windowWidth: element.offsetWidth,
      windowHeight: element.offsetHeight,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => {
        applyPdfCanvasUnderlineFixes(clonedDoc);
      },
    });

    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
      compress: true,
    });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, 210, 297);
    pdf.save(pdfName);
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * Open a print-as-PDF dialog for a certificate.
 */
export async function printCertificate(data) {
  const html = await generateCertificateHTML(data);
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { alert(t('cert.popupPrint')); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

const CERT_PREVIEW_SCREEN_CSS = `<style id="cert-preview-screen">
/* cert-screen-scroll */
@media screen {
  html, body {
    overflow: auto !important;
    height: auto !important;
    min-height: 100%;
    background: #e8e8e8;
  }
  .cert-page,
  .cert-page-visa-abroad,
  .page {
    width: 210mm;
    height: auto !important;
    min-height: 297mm;
    max-height: none !important;
    overflow: visible !important;
    margin: 16px auto;
    box-shadow: 0 8px 30px rgba(0,0,0,0.12);
  }
  .cert-page-visa-abroad .body-text {
    flex: 0 0 auto !important;
    min-height: auto !important;
    overflow: visible !important;
  }
}
@media print {
  .no-print { display: none !important; }
  body { background: #fff !important; }
  .cert-page, .cert-page-visa-abroad, .page {
    margin: 0 !important;
    box-shadow: none !important;
  }
}
</style>`;

function injectPreviewScreenStyles(html) {
  if (!html || html.includes('cert-preview-screen')) return html;
  if (html.includes('</head>')) {
    return html.replace('</head>', `${CERT_PREVIEW_SCREEN_CSS}</head>`);
  }
  if (html.includes('<body')) {
    return html.replace('<body', `${CERT_PREVIEW_SCREEN_CSS}<body`);
  }
  return `${CERT_PREVIEW_SCREEN_CSS}${html}`;
}

function injectPreviewToolbar(html) {
  if (!html || html.includes('no-print-toolbar')) return html;
  const toolbarHtml = `
    <div class="no-print-toolbar no-print" style="max-width: 210mm; margin: 16px auto 0; padding: 16px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); display: flex; flex-direction: column; gap: 8px; align-items: center; font-family: 'Sarabun', sans-serif; box-sizing: border-box;">
      <div style="display: flex; gap: 16px; align-items: center;">
        <button onclick="window.print()" style="padding: 12px 32px; background: #1a73e8; color: #ffffff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 15px; display: inline-flex; align-items: center; gap: 8px; transition: background 0.2s;">
          🖨 พิมพ์ หรือ บันทึกเป็น PDF (Print / Save as PDF)
        </button>
        <button onclick="window.close()" style="padding: 12px 32px; background: #f1f3f4; color: #3c4043; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 15px; display: inline-flex; align-items: center; gap: 8px; transition: background 0.2s;">
          ปิดหน้าต่าง (Close)
        </button>
      </div>
      <p style="font-size: 11pt; color: #d93025; margin: 4px 0 0; font-weight: bold; text-align: center; line-height: 1.4;">
        💡 คำแนะนำการบันทึกเอกสาร: เมื่อกดปุ่มพิมพ์แล้ว ในช่อง "เครื่องพิมพ์ (Printer)" หรือ "ปลายทาง (Destination)" ให้เลือกเป็น <strong>"บันทึกเป็น PDF" (Save as PDF)</strong> เพื่อเซฟไฟล์เก็บไว้ในเครื่องแบบคมชัดสูงสุด
      </p>
    </div>
  `;
  if (html.includes('<body>')) {
    return html.replace('<body>', `<body>${toolbarHtml}`);
  }
  if (html.includes('<body')) {
    return html.replace(/<body[^>]*>/i, (match) => `${match}${toolbarHtml}`);
  }
  return `${toolbarHtml}${html}`;
}

/**
 * Open a preview (non-print) of the certificate.
 * Returns the window reference.
 */
export async function previewCertificate(data, doPrint = false) {
  let html = injectPreviewScreenStyles(await generateCertificateHTML(data));
  html = injectPreviewToolbar(html);
  const win = window.open('', '_blank', 'width=920,height=900,scrollbars=yes');
  if (!win) { alert(t('cert.popupPreview')); return null; }
  win.document.write(html);
  win.document.close();
  win.focus();
  if (doPrint) { setTimeout(() => win.print(), 500); }
  return win;
}

/**
 * Generate a standalone HTML page with editable fields for HR.
 * Look & feel matches generateCertificateHTML (employee preview):
 *   - Same Angsana New font, gray background, white A4 card
 *   - Same header (company name + address + border)
 *   - Same cert-number-row / doc-title / body-text / signature / footer
 * Editable fields (blue dashed underline) disappear cleanly on print.
 */
export async function generateEditableCertificateHTML(data) {
  const enriched = await enrichCertDataWithMasterData(data);
  const templateRecord = await getTemplateRecord(enriched.doc_type, enriched.language);
  const templateHtml = templateRecord?.content;
  if (!templateHtml) {
    return `<html><body><div style="padding: 20px; font-family: sans-serif; color: red; text-align: center;">ไม่พบเทมเพลตสำหรับเอกสารประเภทนี้ในระบบ กรุณาตรวจสอบการตั้งค่าเทมเพลต</div></body></html>`;
  }

  let html = templateHtml;
  
  // Inject editor toolbar stylesheet/scripts so window.print works
  const toolbarHtml = `
    <div class="toolbar">
      <button onclick="window.print()" class="print-btn">🖨 พิมพ์เป็น PDF</button>
      <p class="edit-hint">ช่องเส้นประสีน้ำเงิน = แก้ไขได้ &nbsp;|&nbsp; กดพิมพ์เมื่อกรอกครบแล้ว</p>
    </div>
  `;
  
  html = html.replace('<body>', `<body>${toolbarHtml}`);
  
  const editorStyles = `
    body { background: #e8e8e8 !important; }
    .cert-wrapper { max-width: 210mm; margin: 0 auto; }
    .cert-page { box-shadow: 0 8px 30px rgba(0,0,0,0.12); background: #fff; position: relative; }
    .editable-input {
      display: inline-block; border: none; border-bottom: 1.5px dashed #1a73e8;
      background: #e8f0fe; padding: 0 4px; font: inherit; font-weight: 700;
      outline: none; min-width: 180px; color: #1a1a1a;
      vertical-align: baseline; line-height: 1.2; text-align: center;
    }
    .editable-input:focus { background: #c5d9fb; }
    .toolbar {
      max-width: 210mm; margin: 0 auto; padding: 16px 0;
      display: flex; flex-direction: column; align-items: center; gap: 6px;
    }
    .print-btn {
      display: inline-flex; align-items: center; gap: 10px; padding: 14px 48px;
      background: #1a73e8; color: #fff; border: none; border-radius: 12px;
      font-size: 16pt; font-family: 'Angsana New','Sarabun',sans-serif;
      font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(26,115,232,0.3);
    }
    .print-btn:hover { background: #1557b0; }
    .edit-hint { font-size: 10pt; color: #888; font-family: 'Sarabun',sans-serif; }
    @media print {
      body { background: #fff !important; }
      .cert-page { box-shadow: none; padding: 20mm 25mm; }
      .toolbar { display: none !important; }
      .editable-input {
        border: none !important; border-bottom: 1px solid #1a1a1a !important;
        background: transparent !important;
      }
    }
  `;
  html = html.replace('</style>', `${editorStyles}</style>`);
  
  const hr_salary_amount = data.hr_salary_amount || '';
  const hr_signer_name = data.hr_signer_name || '';
  const hr_signer_position = data.hr_signer_position || 'HR Department Manager';

  html = html.replace('{{salary_amount}}', `<input class="editable-input" name="hr_salary_amount" value="${hr_salary_amount.replace(/"/g,'&quot;')}" placeholder="ระบุจำนวนเงิน" style="min-width:100px;" />`);
  html = html.replace('{{hr_signer_name}}', `<input class="editable-input" name="hr_signer_name" value="${hr_signer_name.replace(/"/g,'&quot;')}" placeholder="ชื่อผู้ลงนาม" style="min-width:260px;" />`);
  html = html.replace('{{hr_signer_position}}', `<input class="editable-input" name="hr_signer_position" value="${hr_signer_position.replace(/"/g,'&quot;')}" placeholder="ตำแหน่งผู้ลงนาม" style="min-width:240px;font-weight:400;" />`);

  return parseTemplatePlaceholders(html, buildCertVariables(enriched, templateRecord));
}

/**
 * Open a new window with the editable certificate for HR to fill/print.
 * Reads request + user + master data from localStorage; marks cert_ready.
 */
export async function openEditableCertificate(reqId) {
  const rawReqs = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
  const raw = rawReqs.find(r => r.id === reqId);
  if (!raw) { alert(t('cert.notFound')); return; }

  const users      = JSON.parse(localStorage.getItem('hrbp_mock_users') || '[]');
  const user       = users.find(u => u.email === raw.user_email) || {};

  const idx = rawReqs.findIndex(r => r.id === reqId);
  if (idx !== -1) {
    rawReqs[idx] = stampCertDownloadFields({
      ...rawReqs[idx],
      status: 'approved',
      statusLabel: t('status.approved'),
    }, isoToday());
    localStorage.setItem('hrbp_employee_requests', JSON.stringify(rawReqs));
  }

  const saved = rawReqs.find(r => r.id === reqId) || raw;
  const data = buildCertDataFromRequest(saved, user);
  if (!isIssuedCertNumber(saved)) {
    const storedTpls = JSON.parse(localStorage.getItem('hrbp_templates') || '[]');
    const savedTmpl = storedTpls.find(t => t.id === saved.cert_template_id);
    data.cert_number = peekCertNumber(savedTmpl ? isEnglishTemplate(savedTmpl) : false);
  }
  if (!data.company_name && user.company_name) data.company_name = user.company_name;

  const html = await generateEditableCertificateHTML(data);
  const win  = window.open('', '_blank', 'width=960,height=720');
  if (!win) { alert(t('cert.popupCreate')); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
}
