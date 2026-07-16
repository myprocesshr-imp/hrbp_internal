/**
 * Certificate Builder Workspace
 * Interactive HR tool to build, preview, and print employment certificates.
 *
 * Storage Strategy for Digital Signatures:
 *   Stored in localStorage['hrbp_hr_signatures'] as { [userId]: base64DataURL }
 *   This is the optimal approach for a browser-based SPA — no server needed,
 *   persists across sessions, and is keyed to the HR Manager's user ID.
 *   The signature panel provides upload/delete management per manager.
 */
import { navigate } from '../router.js';
import { getCurrentUser } from '../mock-data.js';
import { updateUser, getTemplates, getEmployeeRequests, getUsers, getCertMasterData, uploadFile, updateRequest } from '../lib/api.js';
import {
  buildEmployeeDisplayFields,
  buildEnglishName,
  formatEnglishDateFull,
  formatPhoneInternational,
  genderPronounPlaceholders,
  isEnglishTemplate,
  todayEnglishFull,
} from '../lib/hrms-helper.js';
import { syncVisaAbroadTemplateInStorage, syncWorkEnTemplateInStorage, syncWorkThTemplateInStorage, seedTemplates } from './admin-templates.js';
import {
  allocateCertNumber,
  buildCertIssueSnapshot,
  finalizeCertificateOutputHtml,
  formatCertNumber,
  parseCertNumber,
  peekCertNumber,
  syncCertCounter,
} from '../lib/templates.js';
import { isoToday, computeDownloadUntil, parseThaiIssuedDate } from '../lib/download-policy.js';

function fillTemplatePlaceholders(html, reps) {
  let out = html;
  Object.keys(reps).forEach(k => {
    out = out.replace(new RegExp(`{{${k}}}`, 'g'), reps[k] ?? '');
  });
  return out;
}

function parseTemplateHtml(html) {
  const styleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  const styles = styleBlocks.map(s => s.replace(/<\/?style[^>]*>/gi, '')).join('\n');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1].trim() : html;
  return { styles, bodyContent };
}

function setStoredTemplateMode(active) {
  const a4 = document.getElementById('cb-a4');
  if (!a4) return;
  a4.classList.toggle('cb-using-stored-template', active);
  a4.style.padding = active ? '0' : '22mm 28mm 28mm';
}

function ensureTemplateStyleEl() {
  let el = document.getElementById('cb-template-styles');
  if (!el) {
    el = document.createElement('style');
    el.id = 'cb-template-styles';
    document.getElementById('cb-a4')?.prepend(el);
  }
  return el;
}

function resolveCompanyAddress(emp, th) {
  let ca_th = '';
  let ca_en = '';
  let coNameTh = '';
  let coNameEn = '';
  const compName = emp?.company || '';
  const co = COMPANY_MAP[compName] || { th: compName, en: compName };
  coNameTh = co.th;
  coNameEn = co.en;

  try {
    const masterDataStr = localStorage.getItem('hrbp_cert_master_data');
    if (masterDataStr) {
      const md = JSON.parse(masterDataStr);
      const foundCo = md.companies?.find(c =>
        (c.name && compName.toLowerCase().includes(c.name.toLowerCase())) ||
        (c.name_en && compName.toLowerCase().includes(c.name_en.toLowerCase())) ||
        (c.name && c.name.toLowerCase().includes(compName.toLowerCase())) ||
        (c.name_en && c.name_en.toLowerCase().includes(compName.toLowerCase()))
      );
      if (foundCo) {
        if (foundCo.name) coNameTh = foundCo.name;
        if (foundCo.name_en) coNameEn = foundCo.name_en;
        const addr = md.addresses?.find(a => a.company_id === foundCo.id);
        if (addr) {
          ca_th = addr.address || '';
          ca_en = addr.address_en || addr.address || '';
        }
      }
    }
  } catch (_) {}

  if (!ca_th) {
    if (compName.includes('Mango') || compName.includes('แมงโก้')) {
      ca_th = '123 อาคารสิริภิญโญ ชั้น 8 ถนนศรีอยุธยา แขวงถนนพญาไท เขตราชเทวี กรุงเทพมหานคร 10400';
      ca_en = '123 Siripinyo Building, 8th Floor, Sri Ayutthaya Road, Ratchathewi, Bangkok 10400';
    } else if (compName.includes('Corporate') || compName.includes('คอร์ปอเรท')) {
      ca_th = '456 อาคารออลซีซั่นส์ เพลส ชั้น 20 ถนนวิทยุ แขวงลุมพินี เขตปทุมวัน กรุงเทพมหานคร 10330';
      ca_en = '456 All Seasons Place, 20th Floor, Wireless Road, Pathum Wan, Bangkok 10330';
    } else if (compName.includes('HRBP') || compName.includes('เอชอาร์บีพี')) {
      ca_th = '789 อาคารเอ็มไพร์ ทาวเวอร์ ชั้น 35 ถนนสาทรใต้ แขวงยานนาวา เขตสาทร กรุงเทพมหานคร 10120';
      ca_en = '789 Empire Tower, 35th Floor, South Sathorn Road, Sathon, Bangkok 10120';
    } else {
      ca_th = '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110';
      ca_en = '123/45 Sukhumvit Road, Khlong Toei, Bangkok 10110';
    }
  }

  return {
    coNameTh,
    coNameEn,
    address: th ? ca_th : ca_en,
    addressTh: ca_th,
    addressEn: ca_en,
  };
}

// ─── CONSTANTS ────────────────────────────────────────────────
const FOOTER_LANDLINE  = '038-540330';
const SIGNATURES_KEY   = 'hrbp_hr_signatures';
const MOCK_USERS_KEY   = 'hrbp_mock_users';
const CERT_NOTES_KEY   = 'hrbp_cert_master_data';

const THAI_MONTHS_FULL = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
];
const THAI_MONTHS_SHORT = [
  'ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
  'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'
];

// ─── MASTER DATA ──────────────────────────────────────────────
const DEFAULT_HR_STAFF = [
  { id: 'U003', full_name: 'วิภาดา รักษาธรรม', role: 'admin', position: 'HR Manager', email: 'wipada.r@company.com', phone: '081-234-5678', responsible_bu: 'People Operation', is_manager: true },
  { id: 'U004', full_name: 'ชัยพล รัตนศิริ',   role: 'hrbp',  position: 'HRBP Specialist', email: 'chaiyaphol.r@company.com', phone: '081-234-5679', responsible_bu: 'Business Partnering', is_manager: false },
  { id: 'HR003', full_name: 'สมชาย รักงาน',    role: 'hrbp',  position: 'HRBP - Technology', email: 'somchai.r@company.com', phone: '081-234-5680', responsible_bu: 'Technology', is_manager: false },
  { id: 'HR004', full_name: 'สมหญิง จริงใจ',   role: 'hrbp',  position: 'HRBP - Marketing', email: 'somying.j@company.com', phone: '081-234-5681', responsible_bu: 'Marketing', is_manager: false },
  { id: 'HR005', full_name: 'นภา สดใส',        role: 'hrbp',  position: 'HRBP - Design & Product', email: 'napa.s@company.com', phone: '081-234-5682', responsible_bu: 'Design & Product', is_manager: false },
];

const DEFAULT_REMARKS = [
  { id: 'R001', th: 'ใช้ประกอบการยื่นกู้สินเชื่อธนาคาร',       en: 'For bank loan application' },
  { id: 'R002', th: 'ใช้ประกอบการศึกษาต่อ',                    en: 'For further education' },
  { id: 'R003', th: 'ใช้ประกอบการขอวีซ่า',                      en: 'For visa application' },
  { id: 'R004', th: 'ใช้ประกอบการเช่าที่พักอาศัย',              en: 'For rental application' },
  { id: 'R005', th: 'ใช้ประกอบการขอสินเชื่อรถยนต์',             en: 'For car loan application' },
  { id: 'R006', th: 'ใช้ในราชการ',                              en: 'For official government purposes' },
  { id: 'R007', th: 'ใช้ประกอบการเปิดบัญชีธนาคาร',              en: 'For bank account opening' },
  { id: 'R008', th: 'ตามที่พนักงานร้องขอ',                       en: 'As requested by employee' },
];

const COMPANY_MAP = {
  'Mango':      { th: 'บริษัท แมงโก้ จำกัด',                   en: 'Mango Company Limited' },
  'Corporate':  { th: 'บริษัท คอร์ปอเรท คลาริตี้ จำกัด',        en: 'Corporate Clarity Company Limited' },
  'HRBP Group': { th: 'บริษัท เอชอาร์บีพี กรุ๊ป จำกัด',          en: 'HRBP Group Company Limited' },
};

const CATEGORY_CONFIG = {
  'หนังสือรับรองการทำงาน': { showSalary: false, titleTH: 'หนังสือรับรองการทำงาน', titleEN: 'Certificate of Employment' },
  'หนังสือรับรองเงินเดือน': { showSalary: true, titleTH: 'หนังสือรับรองเงินเดือน', titleEN: 'Salary Certificate' },
  'หนังสือรับรองเพื่อทำวีซ่า': { showSalary: false, titleTH: 'หนังสือรับรองเพื่อการขอวีซ่า', titleEN: 'Visa Support Letter' },
};

const DOC_CAT_MAP = {
  'ใบรับรองการทำงาน': 'หนังสือรับรองการทำงาน',
  'หนังสือรับรองการทำงาน': 'หนังสือรับรองการทำงาน',
  'ใบรับรองเงินเดือน': 'หนังสือรับรองเงินเดือน',
  'หนังสือรับรองเงินเดือน': 'หนังสือรับรองเงินเดือน',
  'ใบรับรองเพื่อการขอวีซ่า': 'หนังสือรับรองเพื่อทำวีซ่า',
  'หนังสือรับรองเพื่อการขอวีซ่า': 'หนังสือรับรองเพื่อทำวีซ่า',
  'ใบรับรองกรณีส่งพนักงานไปทำงานต่างประเทศ': 'หนังสือรับรองเพื่อทำวีซ่า',
  'หนังสือรับรองกรณีส่งพนักงานทำงานไปต่างประเทศ': 'หนังสือรับรองเพื่อทำวีซ่า',
};

function isWorkCertThTemplate(tmpl) {
  return tmpl?.id === 'tpl-work-th'
    || (tmpl?.category === 'หนังสือรับรองการทำงาน' && !isEnglishTemplate(tmpl));
}

const OUTER_CONTROL_IDS = {
  'cb-off-select': 'cb-outer-off-select',
  'cb-off-name': 'cb-outer-off-name',
  'cb-off-phone': 'cb-outer-off-phone',
  'cb-off-email': 'cb-outer-off-email',
};

function queryCertControlEl(container, id) {
  const a4 = container.querySelector('#cb-a4');
  if (a4?.classList.contains('cb-using-stored-template')) {
    const inBody = container.querySelector('#cb-body')?.querySelector(`#${id}`);
    if (inBody) return inBody;
  } else {
    const mappedId = OUTER_CONTROL_IDS[id] || id;
    for (const scope of ['#cb-outer-footer', '#cb-outer-signature', '#cb-body']) {
      const el = container.querySelector(`${scope} #${mappedId}`) || container.querySelector(`${scope} #${id}`);
      if (el) return el;
    }
  }
  const mappedId = OUTER_CONTROL_IDS[id];
  return container.querySelector(`#${id}`) || (mappedId ? container.querySelector(`#${mappedId}`) : null);
}

function resolveOfficerContact(container, staff, curOffId) {
  const getEl = id => queryCertControlEl(container, id);
  const sel = getEl('cb-off-select');
  const fromOpt = officerFromSelectOption(sel);
  const officer = findHrbpById(staff, curOffId || sel?.value || fromOpt?.id);
  const name = fromOpt?.full_name
    || officer?.full_name
    || getEl('cb-off-name')?.textContent?.trim()
    || (sel?.value && sel.selectedOptions?.[0]
      ? (sel.selectedOptions[0].dataset.name || sel.selectedOptions[0].textContent || '').trim()
      : '');
  const phone = getEl('cb-off-phone')?.textContent?.trim()
    || fromOpt?.phone
    || officer?.phone
    || '';
  const email = getEl('cb-off-email')?.textContent?.trim()
    || fromOpt?.email
    || officer?.email
    || '';
  return {
    name: name && !name.includes('เลือก HRBP') ? name : (officer?.full_name || ''),
    phone: phone && phone !== '-' ? phone : (officer?.phone || ''),
    email: email && email !== '-' ? email : (officer?.email || ''),
  };
}

function officerNameFromUi(getEl, staff, curOffId) {
  const sel = getEl('cb-off-select');
  const fromOpt = officerFromSelectOption(sel);
  if (fromOpt?.full_name) return fromOpt.full_name;
  if (sel?.value && sel.selectedOptions?.[0]) {
    const label = (sel.selectedOptions[0].dataset.name || sel.selectedOptions[0].textContent || '').trim();
    if (label && !label.includes('เลือก HRBP')) return label;
  }
  const hidden = getEl('cb-off-name')?.textContent?.trim();
  if (hidden && !hidden.includes('เลือก HRBP')) return hidden;
  if (staff && curOffId) {
    const officer = findHrbpById(staff, curOffId);
    if (officer?.full_name) return officer.full_name;
  }
  return '';
}

function signatureImgHtml(sigSrc, alt = 'Signature') {
  if (!sigSrc) return '';
  const safeSrc = String(sigSrc).replace(/"/g, '&quot;');
  const safeAlt = escapeHtmlAttr(alt);
  return `<img src="${safeSrc}" alt="${safeAlt}" style="max-height:100%;max-width:100%;object-fit:contain;" />`;
}

function openCertificatePrintWindow(html) {
  const win = window.open('', '_blank');
  if (!win) return null;

  win.document.open();
  win.document.write(html);
  win.document.close();

  const runPrint = () => {
    try {
      win.focus();
      win.print();
    } catch (_) {}
  };

  const schedulePrint = () => setTimeout(runPrint, 500);

  if (win.document.readyState === 'complete') schedulePrint();
  else win.addEventListener('load', schedulePrint, { once: true });

  win.addEventListener('afterprint', () => {
    setTimeout(() => { try { win.close(); } catch (_) {} }, 200);
  }, { once: true });

  return win;
}

function populateCertificateControlSelects(container, { managers, staff, remarks, isThai, curMgrId, curOffId }) {
  const $ = id => queryCertControlEl(container, id);
  const mgrSel = $('cb-mgr-select');
  if (mgrSel) {
    const prev = mgrSel.value || curMgrId || '';
    mgrSel.innerHTML = '<option value="">— เลือกผู้มีอำนาจลงนาม —</option>'
      + managers.map(m => `<option value="${m.id}">${m.full_name} — ${m.position}</option>`).join('');
    mgrSel.value = prev || managers[0]?.id || '';
  }
  const hrbpStaff = getHrbpStaff(staff);
  const offOptsHtml = buildHrbpOptionsHtml(hrbpStaff);
  const prevOff = $('cb-off-select')?.value || curOffId || '';
  container.querySelectorAll('#cb-off-select, #cb-outer-off-select').forEach(offSel => {
    offSel.innerHTML = offOptsHtml;
    offSel.value = prevOff || hrbpStaff[0]?.id || '';
  });
  const rmkSel = $('cb-rmk-select');
  if (rmkSel) {
    const prev = rmkSel.value;
    rmkSel.innerHTML = '<option value="">— เลือกหมายเหตุ —</option>'
      + remarks.map(r => {
        const th = escapeHtmlAttr(r.th);
        const en = escapeHtmlAttr(r.en);
        const label = isThai() ? r.th : r.en;
        return `<option value="${escapeHtmlAttr(r.id)}" data-th="${th}" data-en="${en}">${escapeHtmlAttr(label || r.th || r.en)}</option>`;
      }).join('');
    if (prev) rmkSel.value = prev;
  }
}

let publishedTemplatesCache = [];
let loadedReqCache = null;
let hrDataCache = null;

export async function prefetchTemplates() {
  try {
    const res = await getTemplates();
    if (res && res.data) {
      publishedTemplatesCache = res.data.filter(t => t.status === 'published');
    }
  } catch (_) {}
}

export async function prefetchHRStaff() {
  try {
    const res = await getUsers();
    if (res?.users?.length) {
      const existing = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');
      const merged = [...existing];
      res.users.forEach(u => {
        const idx = merged.findIndex(e => e.id === u.id || e.username === u.username);
        if (idx >= 0) Object.assign(merged[idx], u);
        else merged.push(u);
      });
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(merged));
    }
  } catch (_) {}
}

export async function prefetchCertMasterData() {
  try {
    const res = await getCertMasterData();
    if (res?.data && (res.data.companies || res.data.addresses)) {
      localStorage.setItem('hrbp_cert_master_data', JSON.stringify(res.data));
    }
  } catch (_) {}
}

function loadPublishedTemplates() {
  if (publishedTemplatesCache && publishedTemplatesCache.length > 0) {
    return publishedTemplatesCache;
  }
  try {
    const all = JSON.parse(localStorage.getItem('hrbp_templates') || '[]');
    // If no templates in storage yet, trigger one-time sync to seed defaults
    if (all.length === 0) {
      syncWorkThTemplateInStorage();
      syncWorkEnTemplateInStorage();
      syncVisaAbroadTemplateInStorage();
      publishedTemplatesCache = JSON.parse(localStorage.getItem('hrbp_templates') || '[]').filter(t => t.status === 'published');
    } else {
      publishedTemplatesCache = all.filter(t => t.status === 'published');
    }
    return publishedTemplatesCache;
  } catch (_) { return []; }
}


function getHrbpStaff(staffList) {
  return staffList.filter(o => o.role === 'hrbp');
}

function escapeHtmlAttr(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function normalizeRemarkItem(note, index) {
  if (typeof note === 'string') {
    const text = note.trim();
    return { id: `N${index + 1}`, th: text, en: text };
  }
  if (!note || typeof note !== 'object') {
    const text = String(note ?? '').trim();
    return { id: `N${index + 1}`, th: text, en: text };
  }
  const th = String(note.th ?? note.text ?? '').trim();
  const en = String(note.en ?? note.text_en ?? '').trim();
  return {
    id: String(note.id || `N${index + 1}`),
    th: th || en,
    en: en || th,
  };
}

function buildHrbpOptionsHtml(hrbpStaff) {
  return '<option value="">— เลือก HRBP —</option>'
    + hrbpStaff.map(o => {
      const phone = escapeHtmlAttr(o.phone || '');
      const email = escapeHtmlAttr(o.email || '');
      const name = escapeHtmlAttr(o.full_name || '');
      return `<option value="${escapeHtmlAttr(o.id)}" data-phone="${phone}" data-email="${email}" data-name="${name}">${o.full_name}</option>`;
    }).join('');
}

function findHrbpById(staffList, id) {
  if (!id) return null;
  const sid = String(id);
  const pool = getHrbpStaff(staffList);
  return pool.find(o =>
    String(o.id) === sid
    || String(o.emp_id || '') === sid
    || String(o.username || '') === sid
  ) || staffList.find(o => String(o.id) === sid);
}

function officerFromSelectOption(sel) {
  const opt = sel?.selectedOptions?.[0];
  if (!opt?.value) return null;
  return {
    id: opt.value,
    full_name: opt.dataset.name || opt.textContent?.trim() || '',
    phone: opt.dataset.phone || '',
    email: opt.dataset.email || '',
  };
}

function patchOfficerContactFields(root, contact) {
  if (!root || !contact) return;
  const phone = contact.phone || '-';
  const email = contact.email || '-';
  const name = contact.full_name || '';
  ['cb-off-name', 'cb-outer-off-name'].forEach(id => {
    root.querySelectorAll(`[id="${id}"]`).forEach(el => { el.textContent = name; });
  });
  ['cb-off-phone', 'cb-outer-off-phone'].forEach(id => {
    root.querySelectorAll(`[id="${id}"]`).forEach(el => { el.textContent = phone; });
  });
  ['cb-off-email', 'cb-outer-off-email'].forEach(id => {
    root.querySelectorAll(`[id="${id}"]`).forEach(el => { el.textContent = email; });
  });
  const footer = root.querySelector('#cb-body .footer, #cb-body .cb-cert-footer');
  if (footer) {
    let phoneEl = footer.querySelector('[id="cb-off-phone"]');
    let emailEl = footer.querySelector('[id="cb-off-email"]');
    if (!phoneEl || !emailEl) {
      const contactHtml = `&nbsp;โทร. ${FOOTER_LANDLINE} / <span id="cb-off-phone">${phone}</span> / E-mail : <span id="cb-off-email">${email}</span>`;
      if (footer.innerHTML.includes('038-540330')) {
        footer.innerHTML = footer.innerHTML.replace(
          /&nbsp;โทร\.\s*038-540330\s*\/[\s\S]*$/,
          contactHtml
        );
      }
    } else {
      phoneEl.textContent = phone;
      emailEl.textContent = email;
    }
    const footerNameEl = footer.querySelector('[id="cb-off-name"]');
    if (footerNameEl) footerNameEl.textContent = name;
  }
  const hdrPhone = root.querySelector('#cb-header-hr-phone');
  if (hdrPhone) hdrPhone.textContent = formatPhoneInternational(contact.phone || '') || '-';
}

function wireHrbpFooterSelects(root, onSelect) {
  root.querySelectorAll('#cb-off-select, #cb-outer-off-select').forEach(sel => {
    sel.onchange = e => onSelect(e.currentTarget);
  });
}

function wireWorkEnHeaderPhoneSelect(container, staffList, onSelect) {
  const sel = container.querySelector('#cb-header-hr-select');
  if (!sel) return;
  const hrbpStaff = getHrbpStaff(staffList);
  sel.innerHTML = [
    '<option value="">— Select HRBP —</option>',
    ...hrbpStaff.map(o =>
      `<option value="${o.id}">${o.full_name} — ${formatPhoneInternational(o.phone || '') || '-'}</option>`
    ),
  ].join('');
  sel.onchange = e => onSelect(e.target.value);
}

const TEMPLATES = {
  'without-salary': { thLabel: 'แบบไม่ระบุเงินเดือน',      enLabel: 'Without Salary',              showSalary: false, titleTH: 'หนังสือรับรองการทำงาน',         titleEN: 'Certificate of Employment' },
  'with-salary':    { thLabel: 'แบบระบุเงินเดือน',          enLabel: 'With Salary',                 showSalary: true,  titleTH: 'หนังสือรับรองเงินเดือน',        titleEN: 'Salary Certificate' },
  'visa':           { thLabel: 'สำหรับใช้ยื่นขอวีซ่า',       enLabel: 'For Use in Requesting Visa',  showSalary: false, titleTH: 'หนังสือรับรองเพื่อการขอวีซ่า',  titleEN: 'Visa Support Letter' },
};

// ─── DATA HELPERS ─────────────────────────────────────────────
function todayThaiLong() {
  const d = new Date();
  return `${d.getDate()} ${THAI_MONTHS_FULL[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`;
}
function todayThaiShort() {
  const d = new Date();
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function normalizeDocId(value) {
  const parsed = parseCertNumber(value);
  return parsed ? formatCertNumber(parsed.counter, parsed.year) : String(value || '').replace(/^HRBP\s*/i, '').trim();
}
function resolveDocIdForRequest(req, isEnglish = false) {
  if (req?.cert_number && req?.cert_number_generated) {
    return normalizeDocId(req.cert_number);
  }
  syncCertCounter();
  return peekCertNumber(isEnglish);
}
function loadHRStaff() {
  try {
    const users = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');
    const hrUsers = users.filter(u => ['admin', 'hrmanager', 'hrbp'].includes(u.role));
    if (hrUsers.length > 0) {
      return hrUsers.map(u => ({
        id: String(u.id ?? u.emp_id ?? u.username),
        emp_id: u.emp_id || '',
        username: u.username || '',
        full_name: u.full_name || '',
        role: u.role,
        position: u.position || (u.role === 'admin' ? 'HR Manager' : 'HR Officer'),
        email: u.email || '',
        phone: u.phone || u.mobile || '',
        responsible_bu: Array.isArray(u.responsible_bu) ? u.responsible_bu.join(', ') : (u.responsible_bu || ''),
        is_manager: u.role === 'hrmanager' || u.role === 'admin',
        // Prefer data URL cache (u.signature) for immediate rendering; fall back to R2 key
        signature: u.signature || u.signature_url || null
      }));
    }
  } catch (_) {}
  return DEFAULT_HR_STAFF;
}
function loadManagers() { return loadHRStaff().filter(u => u.is_manager); }
function loadSignatures() {
  const m = loadManagers();
  const s = {};
  m.forEach(x => {
    if (x.signature) {
      s[x.id] = x.signature.startsWith('data:') || x.signature.startsWith('http')
        ? x.signature
        : `/api/signatures/${x.id}`;
    }
  });
  return s;
}
async function saveSignature(uid, dataURL) {
  const blob = await (await fetch(dataURL)).blob();
  const file = new File([blob], `sig-${uid}.png`, { type: blob.type || 'image/png' });
  const uploadRes = await uploadFile(file, 'signatures');
  const key = uploadRes.key || uploadRes.data?.key;
  if (!key) throw new Error('Upload failed — no key returned');
  await updateUser(uid, { signature_url: key });
  // Update localStorage: store dataURL for immediate display,
  // and also store the R2 key in signature_url for persistence across sessions.
  const users = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');
  const u = users.find(x => String(x.id) === String(uid));
  if (u) {
    u.signature_url = key;
    u.signature = dataURL; // store data URL for immediate rendering
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  }
}
async function deleteSignature(uid) {
  try {
    await updateUser(uid, { signature_url: '' });
    const users = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '[]');
    const u = users.find(x => String(x.id) === String(uid));
    if (u) { u.signature_url = ''; localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users)); }
  } catch(e) { console.error('Failed to delete signature', e); }
}
function loadRemarks() {
  try {
    const d = JSON.parse(localStorage.getItem(CERT_NOTES_KEY) || '{}');
    if (d.notes && d.notes.length > 0) {
      return d.notes
        .map((n, i) => normalizeRemarkItem(n, i))
        .filter(r => r.th || r.en);
    }
  } catch (_) {}
  return DEFAULT_REMARKS;
}
function mockEmployee() {
  const hash = window.location.hash || '';
  const match = hash.match(/[?&]reqId=([^&]+)/);
  const reqId = match ? match[1] : null;

  const defaultEmp = {
    nameTH: 'อเล็กซ์ ริเวร่า', nameEN: 'Alex Rivera',
    posTH:  'นักออกแบบผลิตภัณฑ์อาวุโส', posEN: 'Senior Product Designer',
    deptTH: 'การออกแบบประสบการณ์ผู้ใช้', deptEN: 'User Experience Design',
    company: 'อินเตอร์ไทยคอนสตรัคชั่น จำกัด',
    startTH: '15 มกราคม พ.ศ. 2564', startEN: 'January 15<sup>th</sup>, 2021',
    salary: '55,000',
    empCode: 'EMP12345',
  };

  if (reqId) {
    try {
      let req = loadedReqCache && (loadedReqCache.id === reqId || loadedReqCache.request_code === reqId) ? loadedReqCache : null;
      if (!req) {
        const reqs = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
        req = reqs.find(r => r.id === reqId);
      }

      if (req) {
        const users = JSON.parse(localStorage.getItem('hrbp_mock_users') || '[]');
        const user = users.find(u => u.email === req.user_email) || {};
        
        const formatThaiDateFull = (dateStr) => {
          if (!dateStr) return '';
          const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (!m) return dateStr;
          const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
          const d = new Date(+m[1], +m[2] - 1, +m[3]);
          return `${d.getDate()} ${months[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`;
        };
        
        const nameTH = user.full_name || req.user_name || req.name || defaultEmp.nameTH;
        let nameEN = buildEnglishName(user);
        if (!nameEN && req.fname_e) {
          nameEN = `${req.fname_e} ${req.lname_e || ''}`.trim();
        }
        if (!nameEN) {
          nameEN = (user.username ? user.username.split(/[._]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') : '')
            || defaultEmp.nameEN;
        }

        const positionTH = user.position || req.position || defaultEmp.posTH;
        const positionEN = user.position || req.position || defaultEmp.posEN;
        const dept = user.department || req.user_department || req.department || defaultEmp.deptTH;
        const comp = user.company_name || req.company_name || req.company || defaultEmp.company;
        const startDate = user.start_date || req.start_date || '';

        return {
          nameTH,
          nameEN,
          sexId: user.sex_id || req.sex_id || '',
          posTH:  positionTH,
          posEN:  positionEN,
          deptTH: dept,
          deptEN: dept,
          company: comp,
          startTH: formatThaiDateFull(startDate) || defaultEmp.startTH,
          startEN: formatEnglishDateFull(startDate) || defaultEmp.startEN,
          salary:  user.salary || req.salary || defaultEmp.salary,
          empCode: user.emp_id || req.emp_id || user.empCode || defaultEmp.empCode || '______________',
        };
      }
    } catch (_) {}
  }
  return defaultEmp;
}

// ─── RENDER ───────────────────────────────────────────────────
export function renderCertificateBuilder() {
  const storedTemplates = loadPublishedTemplates();
  const initialStored = storedTemplates[0];
  const isThai = initialStored ? !isEnglishTemplate(initialStored) : true;
  syncCertCounter();
  const docId   = peekCertNumber(!isThai);
  const today   = todayThaiLong();
  const todayS  = todayThaiShort();
  const managers   = loadManagers();
  const staff      = loadHRStaff();
  const remarks    = loadRemarks();
  hrDataCache = { managers, staff, remarks };
  const sigs       = loadSignatures();
  const emp        = mockEmployee();
  const company    = COMPANY_MAP[emp.company] || { th: emp.company, en: emp.company };
  const firstMgr   = managers[0];
  const firstSig   = firstMgr ? sigs[firstMgr.id] : null;

  let initialCompanyAddress = '';
  try {
    const masterDataStr = localStorage.getItem('hrbp_cert_master_data');
    if (masterDataStr) {
      const md = JSON.parse(masterDataStr);
      const foundCo = md.companies?.find(c =>
        (c.name    && emp.company.toLowerCase().includes(c.name.toLowerCase()))    ||
        (c.name_en && emp.company.toLowerCase().includes(c.name_en.toLowerCase())) ||
        (c.name    && c.name.toLowerCase().includes(emp.company.toLowerCase()))    ||
        (c.name_en && c.name_en.toLowerCase().includes(emp.company.toLowerCase()))
      );
      if (foundCo) {
        const addr = md.addresses?.find(a => a.company_id === foundCo.id);
        if (addr) initialCompanyAddress = isThai ? addr.address : (addr.address_en || addr.address);
      }
    }
  } catch (_) {}
  if (!initialCompanyAddress) {
    if (emp.company.includes('Mango') || emp.company.includes('แมงโก้')) {
      initialCompanyAddress = isThai
        ? '123 อาคารสิริภิญโญ ชั้น 8 ถนนศรีอยุธยา แขวงถนนพญาไท เขตราชเทวี กรุงเทพมหานคร 10400'
        : '123 Siripinyo Building, 8th Floor, Sri Ayutthaya Road, Ratchathewi, Bangkok 10400';
    } else if (emp.company.includes('Corporate') || emp.company.includes('คอร์ปอเรท')) {
      initialCompanyAddress = isThai
        ? '456 อาคารออลซีซั่นส์ เพลส ชั้น 20 ถนนวิทยุ แขวงลุมพินี เขตปทุมวัน กรุงเทพมหานคร 10330'
        : '456 All Seasons Place, 20th Floor, Wireless Road, Pathum Wan, Bangkok 10330';
    } else if (emp.company.includes('HRBP') || emp.company.includes('เอชอาร์บีพี')) {
      initialCompanyAddress = isThai
        ? '789 อาคารเอ็มไพร์ ทาวเวอร์ ชั้น 35 ถนนสาทรใต้ แขวงยานนาวา เขตสาทร กรุงเทพมหานคร 10120'
        : '789 Empire Tower, 35th Floor, South Sathorn Road, Sathon, Bangkok 10120';
    } else {
      initialCompanyAddress = isThai
        ? '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110'
        : '123/45 Sukhumvit Road, Khlong Toei, Bangkok 10110';
    }
  }

  const tmplOpts = storedTemplates.length > 0
    ? storedTemplates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
    : Object.entries(TEMPLATES).map(([k,v]) => `<option value="${k}">${isThai ? v.thLabel : v.enLabel}</option>`).join('');
  const initialTmplConfig = storedTemplates.length > 0
    ? (CATEGORY_CONFIG[storedTemplates[0].category] || TEMPLATES['without-salary'])
    : TEMPLATES['without-salary'];
  const mgrOpts  = managers.map(m =>
    `<option value="${m.id}">${m.full_name} — ${m.position}</option>`).join('');
  const offOptsInner = buildHrbpOptionsHtml(getHrbpStaff(staff));
  const rmkOpts  = remarks.map(r => {
    const label = isThai ? r.th : r.en;
    return `<option value="${escapeHtmlAttr(r.id)}" data-th="${escapeHtmlAttr(r.th)}" data-en="${escapeHtmlAttr(r.en)}">${escapeHtmlAttr(label || r.th || r.en)}</option>`;
  }).join('');

  return `
<div id="cb-root">

  <main id="cb-canvas">
    <div id="cb-a4"
      class="bg-white w-full max-w-[794px] relative rounded-[2px] mt-8 text-[#1a1a1a]"
      style="box-shadow:0 8px 30px rgba(0,0,0,0.12);padding:22mm 28mm 28mm;font-family:'Angsana New','TH Sarabun New','Sarabun',serif;min-height:297mm;display:flex;flex-direction:column;">

      <!-- Watermark (z-index:0, pointer-events:none, no visible text in content flow) -->
      <div id="cb-outer-watermark" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;overflow:hidden;z-index:0;">
        <span style="font-size:52pt;color:rgba(0,35,111,0.025);font-weight:900;transform:rotate(-28deg);white-space:nowrap;letter-spacing:-2px;user-select:none;">HRBP INTERNAL</span>
      </div>

      <!-- ── HEADER ── -->
      <div id="cb-outer-header" style="position:relative;z-index:1;margin-bottom:6mm;text-align:center;border-bottom:1.5px solid #1a1a1a;padding-bottom:4mm;">
        <div id="cb-co-name-th" style="font-size:20pt;font-weight:bold;line-height:1.25;margin-bottom:1mm;">${company.th}</div>
        <div id="cb-co-name-en" style="font-size:18pt;font-weight:bold;line-height:1.25;margin-bottom:1mm;display:none;"></div>
        <div id="cb-co-address" style="font-size:15pt;line-height:1.4;color:#1a1a1a;">${initialCompanyAddress}</div>
      </div>

      <!-- ── DOC NUMBER (right-aligned, appears once) ── -->
      <div id="cb-outer-docnumber" style="position:relative;z-index:1;text-align:right;font-size:16pt;font-weight:bold;margin-bottom:5mm;">
        เลขที่&nbsp;<span id="cb-docid-text">${docId}</span>
      </div>

      <!-- ── DOCUMENT TITLE ── -->
      <div id="cb-outer-doctitle" style="position:relative;z-index:1;margin-bottom:7mm;">
        <h2 id="cb-doc-title" style="font-size:20pt;font-weight:bold;text-align:center;text-decoration:underline;letter-spacing:1px;">${isThai ? initialTmplConfig.titleTH : initialTmplConfig.titleEN}</h2>
      </div>

      <!-- ── BODY ── -->
      <div id="cb-body" style="position:relative;z-index:1;font-size:16pt;line-height:2;color:#1a1a1a;margin-bottom:6mm;">

        <!-- Main paragraph: uses structured rows so text wraps cleanly -->
        <p style="text-indent:2em;text-align:justify;word-break:break-word;">
          <span id="cb-opening">โดยหนังสือฉบับนี้ขอรับรองว่า</span>
          <span id="cb-emp-name" style="font-weight:bold;border-bottom:1px solid #1a1a1a;padding:0 4px;">${emp.nameTH}</span>
          <span id="cb-lbl-empcode"> รหัสพนักงาน </span>
          <span id="cb-emp-empcode" style="font-weight:bold;border-bottom:1px solid #1a1a1a;padding:0 4px;">${emp.empCode}</span>
          <span id="cb-lbl-co"> เป็นพนักงานของบริษัท </span>
          <span id="cb-emp-co" style="font-weight:bold;border-bottom:1px solid #1a1a1a;padding:0 4px;">${company.th}</span>
          <span id="cb-lbl-pos"> ปฏิบัติงานในตำแหน่ง </span>
          <span id="cb-emp-pos" style="font-weight:bold;border-bottom:1px solid #1a1a1a;padding:0 4px;">${emp.posTH}</span>
          <span id="cb-lbl-dept"> ฝ่าย </span>
          <span id="cb-emp-dept" style="font-weight:bold;border-bottom:1px solid #1a1a1a;padding:0 4px;">${emp.deptTH}</span>
          <span id="cb-lbl-since"> เริ่มทำงานตั้งแต่วันที่ </span>
          <span id="cb-emp-start" style="font-weight:bold;border-bottom:1px solid #1a1a1a;padding:0 4px;">${emp.startTH}</span>
          <span id="cb-lbl-to"> ถึงปัจจุบัน</span>
          <span id="cb-salary-row" style="display:none;">
            <span id="cb-lbl-salary"> และได้รับอัตราเงินเดือนปัจจุบัน เดือนละ </span>
            <input id="cb-emp-salary" type="text" value="${emp.salary}"
              title="คลิกเพื่อแก้ไขเงินเดือน"
              style="font-family:inherit;font-size:16pt;font-weight:bold;border:none;border-bottom:1.5px dashed #1a73e8;background:#e8f0fe;padding:0 6px;width:110px;text-align:center;outline:none;color:#1a1a1a;vertical-align:baseline;" />
            <span id="cb-lbl-baht"> บาท</span>
          </span>
        </p>

        <!-- Remark row -->
        <div style="margin-top:6mm;display:flex;align-items:baseline;gap:4px;flex-wrap:wrap;">
          <span id="cb-lbl-purpose" style="font-weight:bold;white-space:nowrap;">หมายเหตุ :</span>
          <span style="position:relative;display:inline-block;">
            <span id="cb-rmk-text" contenteditable="true"
              style="border-bottom:1.5px dashed #1a73e8;color:#1a1a1a;font-weight:600;padding:0 4px;min-width:80px;outline:none;cursor:text;display:inline-block;"
              title="เลือกจากรายการหรือพิมพ์แก้ไขเอง">— เลือกหมายเหตุ / Select Remark —</span>
            <select id="cb-rmk-select"
              style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;"
              aria-label="Select remark">
              <option value="">— เลือกหมายเหตุ / Select Remark —</option>
              ${rmkOpts}
            </select>
          </span>
        </div>

      </div><!-- /cb-body -->
      <!-- ── SIGNATURE AREA ── -->
      <div id="cb-outer-signature" style="position:relative;z-index:1;margin-top:6mm;display:flex;justify-content:flex-end;font-size:16pt;color:#1a1a1a;">
        <div style="text-align:center;min-width:250px;">

          <!-- Issue Date (editable) -->
          <div style="margin-bottom:1.5mm;display:flex;align-items:center;justify-content:center;gap:4px;">
            <span id="cb-date-label">ออกให้ ณ วันที่</span>
            <span id="cb-issue-date"
              contenteditable="true"
              title="คลิกเพื่อแก้ไขวันที่"
              style="border-bottom:1.5px dashed #1a73e8;color:#1a73e8;font-weight:600;padding:0 4px;min-width:60px;outline:none;cursor:text;">${today}</span>
          </div>

          <!-- Signature Image -->
          <div id="cb-sig-box" style="width:200px;height:68px;margin:0 auto 1mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">
            ${firstSig
              ? `<img src="${firstSig}" id="cb-sig-img" style="max-height:100%;max-width:100%;object-fit:contain;" alt="Digital Signature" />`
              : `<div style="text-align:center;"><span class="material-symbols-outlined" style="color:#e2e8f0;font-size:28px;">draw</span></div>`}
          </div>

          <!-- Manager selector (HR-editable dropdown) -->
          <div style="position:relative;display:inline-block;width:100%;margin-top:0;">
            <div id="cb-mgr-display"
              title="คลิกเพื่อเลือกผู้ลงนาม"
              style="font-size:16pt;font-weight:bold;color:#1a73e8;border-bottom:1.5px dashed #1a73e8;cursor:pointer;">
              (&nbsp;<span id="cb-mgr-name">${firstMgr ? firstMgr.full_name : '______________'}</span>&nbsp;)
            </div>
            <select id="cb-mgr-select"
              style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;"
              aria-label="Select HR Manager">
              <option value="">— เลือกผู้มีอำนาจลงนาม —</option>
              ${mgrOpts}
            </select>
          </div>
          <div id="cb-mgr-pos" style="font-size:16pt;margin-top:0;">${firstMgr ? firstMgr.position : 'ผู้จัดการฝ่ายทรัพยากรบุคคล'}</div>
        </div>
      </div>

      <!-- ── FOOTER (flow layout, not absolute — prevents content overlap) ── -->
      <div id="cb-outer-footer" style="position:relative;z-index:1;margin-top:auto;border-top:1px solid #ccc;padding-top:3mm;font-size:15pt;line-height:1.5;color:#1a1a1a;flex-shrink:0;overflow:visible;">
        <strong id="cb-footer-dept"><em>ฝ่ายทรัพยากรมนุษย์</em></strong><br/>
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:3px;">
          <span id="cb-footer-label">คุณ</span>
          <select id="cb-outer-off-select" class="cb-off-select-visible" aria-label="เลือก HRBP">
            ${offOptsInner}
          </select>
          <span id="cb-outer-off-name" hidden aria-hidden="true">${getHrbpStaff(staff)[0] ? getHrbpStaff(staff)[0].full_name : ''}</span>
          <span id="cb-footer-contact">
            &nbsp;โทร. ${FOOTER_LANDLINE} / <span id="cb-outer-off-phone">${getHrbpStaff(staff)[0] ? getHrbpStaff(staff)[0].phone || '-' : '-'}</span> / E-mail : <span id="cb-outer-off-email">${getHrbpStaff(staff)[0] ? getHrbpStaff(staff)[0].email || '-' : '-'}</span>
          </span>
        </div>
      </div>

    </div><!-- /A4 Paper -->
  </main>

  <!-- ═══ SIGNATURE PANEL ═══════════════════════════════════ -->
  <div id="cb-sig-panel" aria-hidden="true">
    <div class="cb-sig-panel-header">
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <span class="material-symbols-outlined" style="font-size:19px;color:#00236f;">draw</span>
        <div>
          <h3>จัดการลายเซ็นดิจิทัล</h3>
          <p>Digital Signature Manager</p>
        </div>
      </div>
      <button type="button" id="cb-sig-panel-close" class="cb-sig-panel-close" aria-label="Close signature panel">
        <span class="material-symbols-outlined" style="font-size:17px;">close</span>
      </button>
    </div>
    <div id="cb-sig-panel-body"></div>
  </div>

  <div id="cb-toast"></div>

  <header id="cb-toolbar">
    <div class="cb-toolbar-left">
      <div class="cb-toolbar-brand-icon">
        <span class="material-symbols-outlined" style="font-size:18px;color:#fff;">description</span>
      </div>
      <div class="cb-toolbar-brand-text">
        <p class="cb-toolbar-title">Certificate Builder</p>
        <p class="cb-toolbar-subtitle">Preview &amp; Edit Mode</p>
      </div>
      <div class="cb-toolbar-divider"></div>
      <div class="cb-toolbar-tmpl">
        <span class="material-symbols-outlined" style="font-size:15px;color:#757682;">auto_stories</span>
        <span class="cb-toolbar-tmpl-label">Template:</span>
        <select id="cb-tmpl-select" class="cb-toolbar-tmpl-select">
          ${tmplOpts}
        </select>
      </div>
    </div>
    <div class="cb-toolbar-center">
      <span class="material-symbols-outlined" style="font-size:14px;color:#00236f;">tag</span>
      <span id="cb-docid-badge">เลขที่: ${docId}</span>
    </div>
    <div class="cb-toolbar-right">
      <button type="button" id="cb-sig-panel-open" class="cb-toolbar-btn" title="Manage Digital Signatures">
        <span class="material-symbols-outlined" style="font-size:15px;">draw</span><span>Signatures</span>
      </button>
      <button type="button" id="cb-save-btn" class="cb-toolbar-btn cb-toolbar-btn-save">
        <span class="material-symbols-outlined" style="font-size:15px;">save</span><span>Save</span>
      </button>
      <button type="button" id="cb-print-btn" class="cb-toolbar-btn cb-toolbar-btn-print">
        <span class="material-symbols-outlined" style="font-size:15px;">print</span><span>Print PDF</span>
      </button>
      <button type="button" id="cb-close-btn" class="cb-toolbar-btn cb-toolbar-btn-close">
        <span class="material-symbols-outlined" style="font-size:15px;">close</span><span>Close</span>
      </button>
    </div>
  </header>

</div>`;
}

// ─── INIT ─────────────────────────────────────────────────────
export async function initCertificateBuilder(container) {
  // Sync D1 templates to ensure interactive dropdowns/selectors are present
  try {
    await seedTemplates();
  } catch (err) {
    console.warn('[Certificate Builder] seedTemplates failed, continuing with cached templates.', err);
  }

  // Fetch real templates from DB/API first
  try {
    const res = await getTemplates();
    if (res && res.data) {
      publishedTemplatesCache = res.data.filter(t => t.status === 'published');
    }
  } catch (err) {
    console.warn('[Certificate Builder] Failed to load templates from database, using fallback.', err);
  }


  const isThai = () => {
    const storedTmpl = loadPublishedTemplates().find(t => t.id === curTemplate);
    if (storedTmpl) return !isEnglishTemplate(storedTmpl);
    return true;
  };
  let managers     = hrDataCache?.managers || loadManagers();
  let staff        = hrDataCache?.staff || loadHRStaff();
  const remarks    = hrDataCache?.remarks || loadRemarks();
  let sigs         = loadSignatures();
  const tplInit = loadPublishedTemplates();
  let curTemplate  = tplInit.length > 0 ? tplInit[0].id : 'without-salary';
  let curMgrId     = managers[0]?.id || null;
  let curOffId     = getHrbpStaff(staff)[0]?.id || null;
  let isApplyingTemplate = false;

  // Re-populate template select options now that API templates are loaded
  // (renderCertificateBuilder() renders before init fetches from API)
  {
    const tSel = document.getElementById('cb-tmpl-select');
    if (tSel) {
      const storedAll = loadPublishedTemplates();
      tSel.innerHTML = storedAll.length > 0
        ? storedAll.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
        : Object.entries(TEMPLATES).map(([k,v]) => `<option value="${k}">${isThai() ? v.thLabel : v.enLabel}</option>`).join('');
    }
  }

  // ── Element accessor (stored template: prefer controls inside #cb-body)
  const queryCertEl = (id, scope) => {
    if (scope) {
      const inScope = scope.querySelector(`#${id}`);
      if (inScope) return inScope;
    }
    const a4 = container.querySelector('#cb-a4');
    if (a4?.classList.contains('cb-using-stored-template')) {
      const inBody = container.querySelector('#cb-body')?.querySelector(`#${id}`);
      if (inBody) return inBody;
    } else {
      const outerId = OUTER_CONTROL_IDS[id] || id;
      for (const sel of ['#cb-outer-footer', '#cb-outer-signature', '#cb-body']) {
        const el = container.querySelector(`${sel} #${outerId}`) || container.querySelector(`${sel} #${id}`);
        if (el) return el;
      }
    }
    return container.querySelector(`#${id}`);
  };
  const $ = id => queryCertEl(id);
  const $chrome = id => document.getElementById(id);

  const isCbUiTarget = (el) => el && (
    el.closest('#cb-root')
    || el.closest('#cb-toolbar')
    || el.closest('#cb-sig-panel')
  );

  // Parse reqId to pre-fill Remark and Template
  const hash = window.location.hash || '';
  const match = hash.match(/[?&]reqId=([^&]+)/);
  const reqId = match ? match[1] : null;
  let loadedReq = null;
  if (reqId) {
    try {
      let req = null;
      try {
        const response = await getEmployeeRequests({ search: reqId, limit: 1 });
        if (response && response.requests && response.requests.length > 0) {
          req = response.requests.find(r => r.id === reqId || r.request_code === reqId);
        }
      } catch (apiErr) {
        console.warn('[Certificate Builder] Failed to fetch request from API, trying localStorage:', apiErr);
      }

      if (!req) {
        const reqs = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
        req = reqs.find(r => r.id === reqId);
      }

        if (req) {
        loadedReq = req;
        loadedReqCache = req;
        const storedTemplates = loadPublishedTemplates();
        if (req.template_id && storedTemplates.some(t => t.id === req.template_id)) {
          curTemplate = req.template_id;
        } else if (storedTemplates.length > 0) {
          // Map req.doc_type to category for reliable matching
          const docTypeToCat = {
            'work': 'หนังสือรับรองการทำงาน',
            'salary': 'หนังสือรับรองเงินเดือน',
            'visa': 'หนังสือรับรองเพื่อทำวีซ่า',
            'abroad': 'หนังสือรับรองเพื่อทำวีซ่า',
          };
          const cat = docTypeToCat[req.doc_type]
            || DOC_CAT_MAP[req.type || req.purpose || '']
            || '';
          const wantEng = req.language === 'ภาษาอังกฤษ' || req.language === 'อังกฤษ' || req.language === 'en';
          if (cat) {
            const found = storedTemplates.find(t =>
              t.category === cat &&
              (wantEng ? isEnglishTemplate(t) : !isEnglishTemplate(t))
            ) || storedTemplates.find(t => t.category === cat);
            if (found) { curTemplate = found.id; }
          }
          // Fallback: partial match on req.type keywords
          if (!cat || !storedTemplates.find(t => t.id === curTemplate)) {
            const typeStr = req.type || '';
            if (typeStr.includes('เงินเดือน') || req.doc_type === 'salary') {
              const found = storedTemplates.find(t => t.category === 'หนังสือรับรองเงินเดือน' && !isEnglishTemplate(t))
                || storedTemplates.find(t => t.category === 'หนังสือรับรองเงินเดือน');
              if (found) curTemplate = found.id;
            } else if (typeStr.includes('วีซ่า') || typeStr.includes('ต่างประเทศ') || req.doc_type === 'visa' || req.doc_type === 'abroad') {
              const found = storedTemplates.find(t => t.category === 'หนังสือรับรองเพื่อทำวีซ่า')
                || storedTemplates.find(t => t.name && (t.name.includes('visa') || t.name.includes('Visa') || t.name.includes('ต่างประเทศ')));
              if (found) curTemplate = found.id;
            } else if (!curTemplate || !storedTemplates.find(t => t.id === curTemplate)) {
              const found = storedTemplates.find(t => t.category === 'หนังสือรับรองการทำงาน' && !isEnglishTemplate(t))
                || storedTemplates.find(t => t.category === 'หนังสือรับรองการทำงาน');
              if (found) curTemplate = found.id;
            }
          }
        }
        // Fallback only when no stored templates exist
        if (!storedTemplates.length) {
          if (req.type && req.type.includes('เงินเดือน')) curTemplate = 'with-salary';
          if (req.type && (req.type.includes('วีซ่า') || req.type.includes('ต่างประเทศ'))) curTemplate = 'visa';
          if (req.doc_type === 'abroad') curTemplate = 'tpl-visa-abroad';
        }
      }
    } catch (_) {}
  }

  const setDocIdDisplay = (docId) => {
    const normalized = normalizeDocId(docId);
    const text = $('cb-docid-text');
    const badge = $chrome('cb-docid-badge');
    if (text) text.textContent = normalized;
    if (badge) badge.textContent = `เลขที่: ${normalized}`;
  };

  {
    const curStoredForDoc = loadPublishedTemplates().find(t => t.id === curTemplate);
    setDocIdDisplay(resolveDocIdForRequest(loadedReq, curStoredForDoc ? isEnglishTemplate(curStoredForDoc) : false));
  }

  // ── Patch employee data into outer DOM after request is loaded
  if (loadedReq) {
    const emp = mockEmployee();
    const th = isThai();
    const co = COMPANY_MAP[emp.company] || { th: emp.company, en: emp.company };
    const setEl = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    setEl('cb-emp-name', th ? emp.nameTH : emp.nameEN);
    setEl('cb-emp-empcode', emp.empCode);
    setEl('cb-emp-co', th ? co.th : co.en);
    setEl('cb-emp-pos', th ? emp.posTH : emp.posEN);
    setEl('cb-emp-dept', th ? emp.deptTH : emp.deptEN);
    const startEl = $('cb-emp-start');
    if (startEl) {
      if (th) startEl.textContent = emp.startTH;
      else startEl.innerHTML = emp.startEN;
    }
    const salaryEl = $('cb-emp-salary');
    if (salaryEl) salaryEl.value = emp.salary;
    // Patch remark if request has a purpose
    if (loadedReq.purpose || loadedReq.hr_purpose_detail) {
      const rmkEl = $('cb-rmk-text');
      const rmkSel = $('cb-rmk-select');
      const rmkText = loadedReq.hr_purpose_detail || loadedReq.purpose || '';
      if (rmkEl && rmkText) {
        rmkEl.textContent = th
          ? (remarks.find(r => r.en === rmkText || r.th === rmkText)?.th || rmkText)
          : (remarks.find(r => r.en === rmkText || r.th === rmkText)?.en || rmkText);
      }
      if (rmkSel && rmkText) {
        const matched = remarks.find(r => r.th === rmkText || r.en === rmkText);
        if (matched) rmkSel.value = matched.id;
      }
    }
    // Patch language/remark select
    if (loadedReq.language) {
      const isEng = loadedReq.language === 'ภาษาอังกฤษ' || loadedReq.language === 'en';
      if (isEng) {
        // Update remark labels to English
        const rSel = $('cb-rmk-select');
        if (rSel) Array.from(rSel.options).forEach(o => {
          if (!o.value) return;
          const den = o.getAttribute('data-en');
          if (den) o.textContent = den;
        });
      }
    }
  }

  // ── Toast
  const toast = (msg, type = 'success') => {
    const el = $chrome('cb-toast'); if (!el) return;
    const isErr = type === 'error';
    const isInfo = type === 'info';
    const bg    = isErr  ? '#fce8e6' : isInfo ? '#dce1ff' : '#f0fdf4';
    const border = isErr ? '#f28b82' : isInfo ? '#b6c4ff' : '#86efac';
    const color  = isErr ? '#b3261e' : isInfo ? '#00236f' : '#166534';
    const icon   = isErr ? 'error'   : isInfo ? 'info'    : 'check_circle';
    el.innerHTML = `<div class="cb-toast-card" style="
        display:flex;align-items:center;gap:12px;
        background:${bg};border:1.5px solid ${border};color:${color};
        font-family:'Noto Sans Thai',Inter,sans-serif;
        font-size:15px;font-weight:600;
        padding:16px 24px;border-radius:16px;
        box-shadow:0 8px 32px rgba(0,0,0,0.18);
        min-width:280px;max-width:480px;line-height:1.5;
      "><span class="material-symbols-outlined" style="font-size:22px;flex-shrink:0">${icon}</span><span>${msg}</span></div>`;
    const card = el.querySelector('.cb-toast-card');
    setTimeout(() => {
      if (card) card.classList.add('cb-toast-leaving');
      setTimeout(() => { el.innerHTML = ''; }, 320);
    }, 2800);
  };

  // ── Success overlay (Save) — large centered modal + auto-redirect
  const showSaveSuccess = (docId) => {
    const el = $chrome('cb-toast'); if (!el) return;
    el.innerHTML = `
      <div id="cb-save-backdrop" style="
          position:fixed;inset:0;background:rgba(0,0,0,0.42);z-index:0;
          animation:cb-toast-bounce-in 0.3s ease both;
      "></div>
      <div class="cb-toast-card" style="
          display:flex;flex-direction:column;align-items:center;gap:18px;
          background:#ffffff;border:2px solid #86efac;
          font-family:'Noto Sans Thai',Inter,sans-serif;
          text-align:center;padding:40px 56px;border-radius:28px;
          box-shadow:0 24px 64px rgba(0,0,0,0.28);
          max-width:440px;position:relative;z-index:1;
        ">
        <span class="material-symbols-outlined" style="font-size:56px;color:#16a34a;display:block">task_alt</span>
        <div>
          <div style="font-size:22px;font-weight:800;color:#14532d;margin-bottom:6px;letter-spacing:-0.01em">บันทึกเอกสารสำเร็จ</div>
          <div style="font-size:15px;color:#166534;font-weight:600">เลขที่ ${docId}</div>
          <div style="font-size:13px;color:#6b7280;margin-top:10px;line-height:1.5">พนักงานสามารถดาวน์โหลดได้แล้ว</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#9ca3af;margin-top:2px">
          <span class="material-symbols-outlined" style="font-size:14px">arrow_back</span>
          กำลังกลับหน้าภาพรวมการจัดการ…
        </div>
      </div>`;
    setTimeout(() => {
      const card = el.querySelector('.cb-toast-card');
      if (card) card.classList.add('cb-toast-leaving');
      setTimeout(() => {
        el.innerHTML = '';
        // Clean up all Certificate Builder DOM elements before navigating
        ['cb-root', 'cb-toolbar', 'cb-sig-panel', 'cb-toast'].forEach(id => {
          document.getElementById(id)?.remove();
        });
        navigate('/admin/dashboard');
      }, 320);
    }, 2400);
  };


  // ── Language
  const switchLang = () => {
    if (document.getElementById('cb-a4')?.classList.contains('cb-using-stored-template')) {
      applyTmpl(curTemplate);
      return;
    }
    const storedTemplates = loadPublishedTemplates();
    const storedTmpl = storedTemplates.find(t => t.id === curTemplate);
    const th = isThai();
    const emp = mockEmployee();
    const co = COMPANY_MAP[emp.company] || { th: emp.company, en: emp.company };
    const tmpl = storedTmpl ? CATEGORY_CONFIG[storedTmpl.category] || TEMPLATES['without-salary'] : TEMPLATES[curTemplate];
    const curRmkId = $('cb-rmk-select')?.value;
    const rmk = remarks.find(r => r.id === curRmkId);

    // Calculate companyAddress
    let ca = '';
    try {
      const masterDataStr = localStorage.getItem('hrbp_cert_master_data');
      if (masterDataStr) {
        const md = JSON.parse(masterDataStr);
        const foundCo = md.companies?.find(c =>
          (c.name    && emp.company.toLowerCase().includes(c.name.toLowerCase()))    ||
          (c.name_en && emp.company.toLowerCase().includes(c.name_en.toLowerCase())) ||
          (c.name    && c.name.toLowerCase().includes(emp.company.toLowerCase()))    ||
          (c.name_en && c.name_en.toLowerCase().includes(emp.company.toLowerCase()))
        );
        if (foundCo) {
          const addr = md.addresses?.find(a => a.company_id === foundCo.id);
          if (addr) ca = th ? addr.address : (addr.address_en || addr.address);
        }
      }
    } catch (_) {}
    if (!ca) {
      if (emp.company.includes('Mango') || emp.company.includes('แมงโก้')) {
        ca = th
          ? '123 อาคารสิริภิญโญ ชั้น 8 ถนนศรีอยุธยา แขวงถนนพญาไท เขตราชเทวี กรุงเทพมหานคร 10400'
          : '123 Siripinyo Building, 8th Floor, Sri Ayutthaya Road, Ratchathewi, Bangkok 10400';
      } else if (emp.company.includes('Corporate') || emp.company.includes('คอร์ปอเรท')) {
        ca = th
          ? '456 อาคารออลซีซั่นส์ เพลส ชั้น 20 ถนนวิทยุ แขวงลุมพินี เขตปทุมวัน กรุงเทพมหานคร 10330'
          : '456 All Seasons Place, 20th Floor, Wireless Road, Pathum Wan, Bangkok 10330';
      } else if (emp.company.includes('HRBP') || emp.company.includes('เอชอาร์บีพี')) {
        ca = th
          ? '789 อาคารเอ็มไพร์ ทาวเวอร์ ชั้น 35 ถนนสาทรใต้ แขวงยานนาวา เขตสาทร กรุงเทพมหานคร 10120'
          : '789 Empire Tower, 35th Floor, South Sathorn Road, Sathon, Bangkok 10120';
      } else {
        ca = th
          ? '123/45 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110'
          : '123/45 Sukhumvit Road, Khlong Toei, Bangkok 10110';
      }
    }

    // Document text
    const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    set('cb-co-name-th',  th ? co.th : co.en);
    set('cb-co-name-en',  th ? co.en : '');
    set('cb-co-address',  ca);
    set('cb-doc-title',   th ? tmpl.titleTH : tmpl.titleEN);
    set('cb-opening',     th ? 'โดยหนังสือฉบับนี้ขอรับรองว่า' : 'This is to certify that');
    set('cb-lbl-empcode', th ? ' รหัสพนักงาน ' : ' Employee ID ');
    set('cb-lbl-pos',     th ? ' ปฏิบัติงานในตำแหน่ง ' : ' Position: ');
    set('cb-lbl-dept',    th ? ' ฝ่าย ' : ' Department: ');
    set('cb-lbl-co',      th ? ' เป็นพนักงานของบริษัท ' : ' is an employee of ');
    set('cb-lbl-since',   th ? ' เริ่มทำงานตั้งแต่วันที่ ' : ' employed since ');
    set('cb-lbl-to',      th ? ' ถึงปัจจุบัน' : ' to the present.');
    set('cb-lbl-salary',  th ? ' และได้รับอัตราเงินเดือนปัจจุบัน เดือนละ ' : ' Monthly salary: ');
    set('cb-lbl-baht',    th ? ' บาท' : ' THB');
    set('cb-lbl-purpose', th ? 'หมายเหตุ :' : 'Remark:');
    set('cb-date-label',  th ? 'ออกให้ ณ วันที่' : 'Issued on');
    set('cb-emp-name',    th ? emp.nameTH : emp.nameEN);
    set('cb-emp-pos',     th ? emp.posTH  : emp.posEN);
    set('cb-emp-dept',    th ? emp.deptTH : emp.deptEN);
    set('cb-emp-co',      th ? co.th : co.en);
    const startEl = $('cb-emp-start');
    if (startEl) {
      if (th) startEl.textContent = emp.startTH;
      else startEl.innerHTML = emp.startEN;
    }
    set('cb-footer-dept', th ? 'ฝ่ายทรัพยากรมนุษย์' : 'Human Resources');
    set('cb-footer-label', th ? 'คุณ' : 'Khun ');
    
    if (rmk && $('cb-rmk-text')) $('cb-rmk-text').textContent = th ? rmk.th : rmk.en;

    // Template select options
    const tSel = $('cb-tmpl-select');
    if (tSel) {
      const currentTemplates = loadPublishedTemplates();
      if (currentTemplates.length > 0) {
        Array.from(tSel.options).forEach(o => {
          const t = currentTemplates.find(x => x.id === o.value);
          if (t) o.textContent = t.name;
        });
      } else {
        Array.from(tSel.options).forEach(o => {
          const t = TEMPLATES[o.value]; if (t) o.textContent = th ? t.thLabel : t.enLabel;
        });
      }
    }
    // Remarks select options
    const rSel = $('cb-rmk-select');
    if (rSel) Array.from(rSel.options).forEach(o => {
      if (!o.value) return;
      const dth = o.getAttribute('data-th'), den = o.getAttribute('data-en');
      o.textContent = th ? dth : den;
    });
  };

  // ── Template
  const applyTmpl = key => {
    if (isApplyingTemplate) return;
    isApplyingTemplate = true;
    try {
      curTemplate = key;
      const storedTemplates = loadPublishedTemplates();
      const storedTmpl = storedTemplates.find(t => t.id === key);
      let config;
      if (storedTmpl) {
        config = CATEGORY_CONFIG[storedTmpl.category] || TEMPLATES['without-salary'];
      } else {
        config = TEMPLATES[key];
      }
      if (!config) return;
      const tmplIsEn = isEnglishTemplate(storedTmpl);
      const th = isThai();
      const previewDocId = peekCertNumber(tmplIsEn);
      const docText = $('cb-docid-text');
      const docBadge = $chrome('cb-docid-badge');
      if (docText) docText.textContent = previewDocId;
      if (docBadge) docBadge.textContent = `เลขที่: ${previewDocId}`;
      const titleEl = $('cb-doc-title');
      if (titleEl) titleEl.textContent = th ? config.titleTH : config.titleEN;
      const row = $('cb-salary-row');
      if (row) row.style.cssText = config.showSalary
        ? 'display:inline;'
        : 'display:none;';
      // Replace body content with template body when stored template has content
      let savedBody = null;
      const bodyEl = $('cb-body');
      if (bodyEl) savedBody = bodyEl.dataset.origHtml || bodyEl.outerHTML;
      if (storedTmpl && storedTmpl.content && bodyEl) {
        const emp = mockEmployee();
        const rmkText = $('cb-rmk-text')?.textContent || '';
        const mgrName = $('cb-mgr-name')?.textContent || '';
        const mgrPos = $('cb-mgr-pos')?.textContent || '';
        const issueDate = $('cb-issue-date')?.textContent || todayThaiLong();
        const officer = resolveOfficerContact(container, staff, curOffId);
        const offName = officer.name;
        const offPhone = officer.phone;
        const offEmail = officer.email;
        const curMgr = managers.find(x => String(x.id) === String(curMgrId));
        const mgrPhone = curMgr?.phone || '';
        const sigSrc = sigs[curMgrId] || $('cb-sig-img')?.src || '';
        const salaryVal = $('cb-emp-salary')?.value || emp.salary;
        const docId = $('cb-docid-text')?.textContent || peekCertNumber(storedTmpl ? isEnglishTemplate(storedTmpl) : false);
        const coInfo = resolveCompanyAddress(emp, th);

        const empDisplay = buildEmployeeDisplayFields({
          full_name: emp.nameTH,
          full_name_en: emp.nameEN,
          sex_id: emp.sexId,
          position: emp.posTH,
          position_en: emp.posEN,
          department: emp.deptTH,
          department_en: emp.deptEN,
          startTH: emp.startTH,
          startEN: emp.startEN,
        }, tmplIsEn);
        const abroadStart = loadedReq?.abroad_start_date || '';
        const abroadEnd = loadedReq?.abroad_end_date || '';
        const reps = {
          company_name: th ? coInfo.coNameTh : coInfo.coNameEn,
          company_name_en: coInfo.coNameEn,
          company_address: th ? coInfo.addressTh : coInfo.addressEn,
          company_address_en: coInfo.addressEn,
          cert_number: docId,
          full_name: empDisplay.full_name,
          full_name_en: empDisplay.full_name_en,
          ...genderPronounPlaceholders(emp.sexId),
          emp_id: emp.empCode,
          position: empDisplay.position,
          department: empDisplay.department,
          start_date: empDisplay.start_date,
          start_date_en: empDisplay.start_date_en,
          purpose: rmkText && !rmkText.includes('เลือกหมายเหตุ') ? rmkText : '________________',
          salary_amount: salaryVal,
          issue_date: tmplIsEn ? todayEnglishFull() : issueDate,
          issue_date_en: todayEnglishFull(),
          hr_signer_name: mgrName,
          hr_signer_position: mgrPos,
          hr_signer_phone_intl: formatPhoneInternational(mgrPhone),
          hr_signer_signature: signatureImgHtml(sigSrc, mgrName),
          hr_officer_name: offName,
          hr_officer_phone: offPhone,
          hr_officer_phone_intl: formatPhoneInternational(offPhone),
          hr_officer_email: offEmail,
          visa_country: loadedReq?.visa_country || loadedReq?.abroad_destination || '______________',
          abroad_start_date_en: formatEnglishDateFull(abroadStart) || '______________',
          abroad_end_date_en: formatEnglishDateFull(abroadEnd) || '______________',
        };

        const filled = fillTemplatePlaceholders(storedTmpl.content, reps);
        const { styles, bodyContent } = parseTemplateHtml(filled);
        ensureTemplateStyleEl().textContent = styles;
        bodyEl.dataset.origHtml = savedBody;
        bodyEl.innerHTML = bodyContent;
        setStoredTemplateMode(true);
        populateCertificateControlSelects(container, { managers, staff, remarks, isThai, curMgrId, curOffId });
        wireHrbpFooterSelects(container, sel => updateOfficer(sel.value, sel));
        syncWorkCertThControlsFromSelects();
        if (bodyEl.querySelector('#cb-header-hr-select')) {
          wireWorkEnHeaderPhoneSelect(bodyEl, staff, id => {
            const hdrSel = bodyEl.querySelector('#cb-header-hr-select');
            updateOfficer(id, hdrSel);
          });
          const hrbpStaff = getHrbpStaff(staff);
          const curOff = hrbpStaff.find(o => o.full_name === offName) || hrbpStaff[0];
          if (curOff) {
            const hdrSel = bodyEl.querySelector('#cb-header-hr-select');
            if (hdrSel) hdrSel.value = curOff.id;
          }
        }
      } else if (bodyEl && bodyEl.dataset.origHtml) {
        bodyEl.innerHTML = bodyEl.dataset.origHtml;
        delete bodyEl.dataset.origHtml;
        const styleEl = document.getElementById('cb-template-styles');
        if (styleEl) styleEl.textContent = '';
        setStoredTemplateMode(false);
        switchLang();
      }
    } finally {
      isApplyingTemplate = false;
    }
  };
  const shouldReapplyStoredTemplate = () => {
    const storedTmpl = loadPublishedTemplates().find(t => t.id === curTemplate);
    return storedTmpl && !isWorkCertThTemplate(storedTmpl);
  };

  // ── Officer (HRBP footer — landline 038-540330 stays fixed)
  const updateOfficer = (id, sourceSel) => {
    if (!id) return;
    curOffId = id;
    staff = loadHRStaff();
    const fromOpt = sourceSel ? officerFromSelectOption(sourceSel) : null;
    const o = findHrbpById(staff, id);
    const contact = {
      full_name: o?.full_name || fromOpt?.full_name || '',
      phone: o?.phone || fromOpt?.phone || '',
      email: o?.email || fromOpt?.email || '',
    };
    if (!contact.full_name && !contact.phone && !contact.email) return;
    patchOfficerContactFields(container, contact);
    container.querySelectorAll('#cb-off-select, #cb-outer-off-select, #cb-header-hr-select').forEach(sel => {
      if (sel && String(sel.value) !== String(id)) sel.value = id;
    });
    if (shouldReapplyStoredTemplate()) applyTmpl(curTemplate);
  };

  // ── Editable controls (document delegation — toolbar may live on body)
  const onCbChange = (e) => {
    const t = e.target;
    if (!isCbUiTarget(t)) return;
    if (t.id === 'cb-tmpl-select') {
      applyTmpl(t.value);
      return;
    }
    if (t.id === 'cb-off-select' || t.id === 'cb-outer-off-select') {
      updateOfficer(t.value, t);
      return;
    }
    if (t.id === 'cb-rmk-select') {
      const rmk = remarks.find(r => r.id === t.value);
      const el = $('cb-rmk-text');
      if (!el) return;
      if (rmk) {
        el.textContent = isThai() ? rmk.th : rmk.en;
        el.classList.remove('italic');
      } else {
        el.textContent = '— เลือกหมายเหตุ —';
      }
      if (shouldReapplyStoredTemplate()) applyTmpl(curTemplate);
    } else if (t.id === 'cb-mgr-select') {
      updateMgr(t.value);
    } else if (t.id === 'cb-header-hr-select') {
      updateOfficer(t.value, t);
    }
  };
  document.addEventListener('change', onCbChange);

  const onCbBlur = (e) => {
    if (!isCbUiTarget(e.target)) return;
    if (e.target.id === 'cb-issue-date' && shouldReapplyStoredTemplate()) {
      applyTmpl(curTemplate);
    }
  };
  document.addEventListener('blur', onCbBlur, true);

  // ── Signature Panel Logic
  const buildSigPanel = () => {
    const body = $chrome('cb-sig-panel-body'); if (!body) return;
    sigs = loadSignatures();
    body.innerHTML = `
      <div class="bg-sky-50 border border-sky-200 rounded-lg p-3 text-[12px] text-sky-700 leading-relaxed">
        <strong>วิธีจัดเก็บ:</strong> ลายเซ็นถูกบันทึกใน R2 storage เชื่อมกับ User ID ของผู้จัดการ HR สามารถอัปโหลดรูปลายเซ็น (PNG/JPG โปร่งใส) และระบบจะแสดงอัตโนมัติในเอกสาร
      </div>
      <div class="space-y-3">
        ${managers.map(m => {
          const has = !!sigs[m.id];
          return `
          <div class="bg-surface-container-low border border-outline-variant rounded-xl p-3">
            <div class="flex items-center justify-between mb-2">
              <div><p class="text-[14px] font-bold text-on-surface">${m.full_name}</p><p class="text-[12px] text-outline">${m.position}</p></div>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${has ? 'bg-[#dcfce7] text-[#166534]' : 'bg-surface-container text-outline'}">
                <span class="w-1.5 h-1.5 rounded-full ${has ? 'bg-[#166534]' : 'bg-outline-variant'}"></span>
                ${has ? 'มีลายเซ็น' : 'ไม่มีลายเซ็น'}
              </span>
            </div>
            <div class="w-full h-16 mb-2 rounded-lg border flex items-center justify-center overflow-hidden ${has ? 'border-outline-variant bg-white' : 'border-dashed border-outline-variant bg-white'}">
              ${has ? `<img src="${sigs[m.id]}" class="max-h-full max-w-full object-contain" />` : '<span class="text-[12px] text-outline">ไม่มีลายเซ็น</span>'}
            </div>
            <div class="flex gap-2">
              <label for="sp-upload-${m.id}" class="flex-1 flex items-center justify-center gap-1 py-1.5 border border-outline-variant rounded-lg text-[12px] text-on-surface-variant cursor-pointer hover:bg-surface-container transition-colors">
                <span class="material-symbols-outlined text-[14px]">upload</span>${has ? 'เปลี่ยน' : 'อัปโหลด'}
              </label>
              <input type="file" id="sp-upload-${m.id}" data-mid="${m.id}" accept="image/*" class="hidden" />
              ${has ? `<button class="sp-del px-3 py-1 border border-error/30 rounded-lg text-[12px] text-error hover:bg-error-container transition-colors" data-mid="${m.id}">
                <span class="material-symbols-outlined text-[14px]">delete</span></button>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;

    managers.forEach(m => {
      body.querySelector(`#sp-upload-${m.id}`)?.addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = async ev => {
          try {
            await saveSignature(String(m.id), ev.target.result);
            managers = loadManagers();
            sigs = loadSignatures();
            buildSigPanel();
            if (String(curMgrId) === String(m.id)) updateMgr(curMgrId);
            toast(`อัปโหลดลายเซ็นของ ${m.full_name} สำเร็จ ✓`);
          } catch (err) {
            console.error('Signature upload error:', err);
            toast(`อัปโหลดไม่สำเร็จ: ${err.message}`, 'error');
          }
        };
        r.readAsDataURL(f);
        e.target.value = '';
      });
    });
    body.querySelectorAll('.sp-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const mid = btn.getAttribute('data-mid');
        await deleteSignature(mid); 
        managers = loadManagers();
        sigs = loadSignatures();
        buildSigPanel();
        if (String(curMgrId) === String(mid)) updateMgr(curMgrId);
        toast('ลบลายเซ็นแล้ว', 'info');
      });
    });
  };

  // ── Manager / Signatory (HR Manager role only)
  const updateMgr = id => {
    if (!id) return;
    curMgrId = id;
    const m = managers.find(x => String(x.id) === String(id)); if (!m) return;
    const nameEl = $('cb-mgr-name'), posEl = $('cb-mgr-pos'), phoneEl = $('cb-mgr-phone');
    if (nameEl) nameEl.textContent = m.full_name;
    if (posEl)  posEl.textContent  = m.position;
    if (phoneEl) phoneEl.textContent = formatPhoneInternational(m.phone || '') || '-';
    sigs = loadSignatures();
    const box = $('cb-sig-box');
    if (box) box.innerHTML = sigs[id]
      ? `<img src="${sigs[id]}" id="cb-sig-img" class="max-h-full max-w-full object-contain" alt="Signature of ${m.full_name}" />`
: `<div class="text-center"><span class="material-symbols-outlined text-slate-200 text-[28px]">draw</span></div>`;
    buildSigPanel();
    if (shouldReapplyStoredTemplate()) applyTmpl(curTemplate);
  };
  populateCertificateControlSelects(container, { managers, staff, remarks, isThai, curMgrId, curOffId });
  if (managers[0]) { const s = $('cb-mgr-select'); if (s) { s.value = managers[0].id; updateMgr(managers[0].id); } }

  const syncWorkCertThControlsFromSelects = () => {
    const body = container.querySelector('#cb-body');
    if (!body) return;
    const offSel = body.querySelector('#cb-off-select');
    if (offSel?.value) updateOfficer(offSel.value, offSel);
    const mgrSel = body.querySelector('#cb-mgr-select');
    if (mgrSel?.value) updateMgr(mgrSel.value);
  };

  wireHrbpFooterSelects(container, sel => updateOfficer(sel.value, sel));
  const initHrbp = getHrbpStaff(staff)[0];
  if (initHrbp) {
    const s = $('cb-off-select');
    if (s) { s.value = initHrbp.id; updateOfficer(initHrbp.id, s); }
  }

  if (curTemplate) {
    const s = $chrome('cb-tmpl-select');
    if (s) {
      s.value = curTemplate;
      try { applyTmpl(curTemplate); } catch (err) { console.error('[Certificate Builder] applyTmpl failed:', err); }
    }
  }

  // ── Save & Close
  const getReqId = () => {
    const h = window.location.hash || '';
    const m = h.match(/[?&]reqId=([^&]+)/);
    return m ? m[1] : null;
  };

  const sigPanel = $chrome('cb-sig-panel');
  const openSigPanel = () => {
    buildSigPanel();
    if (!sigPanel) return;
    sigPanel.classList.add('cb-sig-panel-open');
    sigPanel.setAttribute('aria-hidden', 'false');
  };
  const closeSigPanel = () => {
    if (!sigPanel) return;
    sigPanel.classList.remove('cb-sig-panel-open');
    sigPanel.setAttribute('aria-hidden', 'true');
  };

  const handleSave = async () => {
    const rId = getReqId();
    if (!rId) { toast('ไม่พบคำขอ (reqId)', 'error'); return; }
    const saveRmk  = $('cb-rmk-text')?.textContent || '';
    const saveMgr  = $('cb-mgr-name')?.textContent || '';
    const savePos  = $('cb-mgr-pos')?.textContent  || '';
    const saveDate = $('cb-issue-date')?.textContent || todayThaiLong();
    const saveOfficer = resolveOfficerContact(container, staff, curOffId);
    const saveOffN = saveOfficer.name;
    const saveOffP = saveOfficer.phone;
    const saveOffE = saveOfficer.email;
    const saveSal  = $('cb-emp-salary')?.value || '';
    try {
      const reqs = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
      const idx  = reqs.findIndex(r => r.id === rId);
      if (idx === -1) { toast('ไม่พบคำขอในระบบ', 'error'); return; }

      let saveDocId;
      if (reqs[idx].cert_number && reqs[idx].cert_number_generated) {
        saveDocId = normalizeDocId(reqs[idx].cert_number);
      } else {
        const curStoredForSave = loadPublishedTemplates().find(t => t.id === curTemplate);
        saveDocId = allocateCertNumber(curStoredForSave ? isEnglishTemplate(curStoredForSave) : false);
        setDocIdDisplay(saveDocId);
      }

      reqs[idx].status        = 'approved';
      reqs[idx].statusLabel   = 'อนุมัติแล้ว';
      reqs[idx].cert_ready    = true;
      reqs[idx].canDownload   = true;
      reqs[idx].can_download  = true;
      const saveMgrRec = managers.find(x => x.full_name === saveMgr);
      reqs[idx].hr_signer_name     = saveMgr;
      reqs[idx].hr_signer_position = savePos;
      reqs[idx].hr_signer_phone    = saveMgrRec?.phone || '';
      const purposeDetail = saveRmk.includes('เลือกหมายเหตุ') ? '' : saveRmk;
      reqs[idx].hr_officer_name    = saveOffN;
      reqs[idx].hr_officer_phone   = saveOffP;
      reqs[idx].hr_officer_email   = saveOffE;
      reqs[idx].hr_officer_id      = curOffId || '';
      reqs[idx].hr_purpose_detail  = purposeDetail;
      reqs[idx].hr_salary_amount   = saveSal;
      reqs[idx].cert_number        = saveDocId;
      reqs[idx].cert_issued_date   = saveDate;
      const issuedIso = parseThaiIssuedDate(saveDate) || isoToday();
      reqs[idx].cert_issued_at     = issuedIso;
      reqs[idx].cert_download_until = computeDownloadUntil(issuedIso);
      const storedTemplates = loadPublishedTemplates();
      const savedTmpl = storedTemplates.find(t => t.id === curTemplate);
      const templateName = savedTmpl ? savedTmpl.name : (TEMPLATES[curTemplate]?.thLabel || curTemplate);
      reqs[idx].cert_template_id   = curTemplate;
      reqs[idx].cert_template_name = templateName;
      reqs[idx].cert_number_generated = true;

      const issuer = getCurrentUser();
      let employeeName = '';
      try {
        const users = JSON.parse(localStorage.getItem('hrbp_mock_users') || '[]');
        const emp = users.find(u => (u.email || '').toLowerCase() === (reqs[idx].user_email || '').toLowerCase());
        employeeName = emp?.full_name || '';
      } catch (_) {}

      reqs[idx].cert_issue_snapshot = buildCertIssueSnapshot({
        cert_number: saveDocId,
        cert_issued_date: saveDate,
        cert_issued_at: issuedIso,
        cert_download_until: reqs[idx].cert_download_until,
        cert_template_id: curTemplate,
        cert_template_name: templateName,
        employee_name: employeeName,
        hr_officer_name: saveOffN,
        hr_officer_phone: saveOffP,
        hr_officer_email: saveOffE,
        hr_officer_id: curOffId || '',
        hr_signer_name: saveMgr,
        hr_signer_position: savePos,
        hr_signer_phone: saveMgrRec?.phone || '',
        hr_purpose_detail: purposeDetail,
        hr_salary_amount: saveSal,
        request_hr_officer_name: reqs[idx].hr_officer?.name || '',
        issued_by_name: issuer?.full_name || issuer?.name || '',
        issued_by_email: issuer?.email || '',
      });
      localStorage.setItem('hrbp_employee_requests', JSON.stringify(reqs));

      // Also persist to D1 database (when Wrangler is running)
      try {
        await updateRequest(rId, {
          status:              'approved',
          statusLabel:         'อนุมัติแล้ว',
          cert_ready:          true,
          canDownload:         true,
          can_download:        true,
          hr_signer_name:      saveMgr,
          hr_signer_position:  savePos,
          hr_signer_phone:     saveMgrRec?.phone || '',
          hr_officer_name:     saveOffN,
          hr_officer_phone:    saveOffP,
          hr_officer_email:    saveOffE,
          hr_officer_id:       curOffId || '',
          hr_purpose_detail:   purposeDetail,
          hr_salary_amount:    saveSal,
          cert_number:         saveDocId,
          cert_issued_date:    saveDate,
          cert_issued_at:      issuedIso,
          cert_download_until: reqs[idx].cert_download_until,
          cert_template_id:    curTemplate,
          cert_template_name:  templateName,
          cert_number_generated: true,
          cert_issue_snapshot: reqs[idx].cert_issue_snapshot,
        });
      } catch (apiErr) {
        console.warn('[Certificate Builder] updateRequest to D1 failed (localStorage saved):', apiErr);
      }

      showSaveSuccess(saveDocId);
    } catch (e) { toast('บันทึกไม่สำเร็จ: ' + e.message, 'error'); }
  };


  const handlePrint = () => {
    const curStoredForPrint = loadPublishedTemplates().find(t => t.id === curTemplate);
    const docId    = $('cb-docid-text')?.textContent || peekCertNumber(curStoredForPrint ? isEnglishTemplate(curStoredForPrint) : false);
    const rmkText  = $('cb-rmk-text')?.textContent || '';
    const mgrName  = $('cb-mgr-name')?.textContent || '';
    const mgrPos   = $('cb-mgr-pos')?.textContent  || '';
    const curMgr   = managers.find(x => String(x.id) === String(curMgrId));
    const mgrPhone = curMgr?.phone || '';
    const issueDate= $('cb-issue-date')?.textContent || todayThaiLong();
    const officer  = resolveOfficerContact(container, staff, curOffId);
    const offName  = officer.name;
    const hdrPhone = container.querySelector('#cb-header-hr-phone')?.textContent?.trim() || '';
    const offPhone = hdrPhone || officer.phone;
    const offEmail = officer.email;
    const sigSrc   = $('cb-sig-img')?.src || sigs[curMgrId] || '';
    const storedTemplates = loadPublishedTemplates();
    const storedTmpl = storedTemplates.find(t => t.id === curTemplate);
    const tmplIsEn = isEnglishTemplate(storedTmpl);
    const th       = isThai();
    const emp      = mockEmployee();
    const co       = COMPANY_MAP[emp.company] || { th: emp.company, en: emp.company };
    const coInfo   = resolveCompanyAddress(emp, th);

    // Try to use template content from storage
    if (storedTmpl && storedTmpl.content) {
      const empDisplay = buildEmployeeDisplayFields({
        full_name: emp.nameTH,
        full_name_en: emp.nameEN,
        sex_id: emp.sexId,
        position: emp.posTH,
        position_en: emp.posEN,
        department: emp.deptTH,
        department_en: emp.deptEN,
        startTH: emp.startTH,
        startEN: emp.startEN,
      }, tmplIsEn);
      const abroadStart = loadedReq?.abroad_start_date || '';
      const abroadEnd = loadedReq?.abroad_end_date || '';
      const variables = {
        company_name: th ? coInfo.coNameTh : coInfo.coNameEn,
        company_name_en: coInfo.coNameEn,
        company_address: th ? coInfo.addressTh : coInfo.addressEn,
        company_address_en: coInfo.addressEn,
        cert_number: docId,
        full_name: empDisplay.full_name,
        full_name_en: empDisplay.full_name_en,
        ...genderPronounPlaceholders(emp.sexId),
        emp_id: emp.empCode,
        position: empDisplay.position,
        department: empDisplay.department,
        start_date: empDisplay.start_date,
        start_date_en: empDisplay.start_date_en,
        purpose: rmkText && !rmkText.includes('เลือกหมายเหตุ') ? rmkText : '________________________________',
        salary_amount: $('cb-emp-salary')?.value || emp.salary,
        issue_date: tmplIsEn ? todayEnglishFull() : issueDate,
        issue_date_en: todayEnglishFull(),
        hr_signer_name: mgrName,
        hr_signer_position: mgrPos,
        hr_signer_phone_intl: formatPhoneInternational(mgrPhone),
        hr_signer_signature: signatureImgHtml(sigSrc, mgrName),
        hr_officer_name: offName,
        hr_officer_phone: offPhone,
        hr_officer_phone_intl: hdrPhone || formatPhoneInternational(offPhone),
        hr_officer_email: offEmail,
        visa_country: loadedReq?.visa_country || loadedReq?.abroad_destination || '______________',
        abroad_start_date_en: formatEnglishDateFull(abroadStart) || '______________',
        abroad_end_date_en: formatEnglishDateFull(abroadEnd) || '______________',
      };
      let rendered = fillTemplatePlaceholders(storedTmpl.content, variables);
      rendered = finalizeCertificateOutputHtml(rendered, { offName, sigSrc });
      if (!openCertificatePrintWindow(rendered)) {
        toast('กรุณาอนุญาต Pop-up เพื่อพิมพ์ PDF', 'error');
        return;
      }
      return;
    }

    const tmpl     = TEMPLATES[curTemplate] || TEMPLATES['without-salary'];
    let companyName = th ? co.th : co.en;
    const companyAddressPrint = $('cb-co-address')?.textContent || '';
    const html = `<!DOCTYPE html>
<html lang="${th ? 'th' : 'en'}">
<head>
<meta charset="UTF-8"/>
<title>${th ? tmpl.titleTH : tmpl.titleEN} — ${docId}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Angsana New','TH Sarabun New','Sarabun',serif;color:#1a1a1a;background:#fff;}
.page{width:210mm;height:297mm;min-height:297mm;max-height:297mm;padding:20mm 25mm 14mm;position:relative;background:#fff;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;}
.body{flex:0 0 auto;margin-bottom:0;}
.sig-area{margin-top:8mm;padding-top:0;flex-shrink:0;}
.ftr{margin-top:auto;flex-shrink:0;page-break-inside:avoid;}
@media print{
  @page{size:A4;margin:0;}
  html,body{margin:0;padding:0;width:210mm;height:297mm;}
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .page{width:210mm;height:297mm;min-height:297mm;max-height:297mm;padding:20mm 25mm 14mm;page-break-inside:avoid;page-break-after:avoid;}
  .bar{display:none;}
}
.wm{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-28deg);font-size:60pt;color:rgba(0,35,111,0.025);font-weight:900;pointer-events:none;white-space:nowrap;letter-spacing:-3px;}
.hdr{text-align:center;margin-bottom:6mm;border-bottom:1.5px solid #1a1a1a;padding-bottom:4mm;}
.co-name{font-size:20pt;font-weight:bold;line-height:1.25;margin-bottom:1mm;}
.co-address{font-size:15pt;line-height:1.4;color:#1a1a1a;}
.id-box{font-size:16pt;font-weight:bold;margin-bottom:5mm;text-align:right;}
.doc-title{font-size:20pt;font-weight:700;letter-spacing:1px;margin-bottom:7mm;text-align:center;text-decoration:underline;}
.body{font-size:16pt;line-height:2;text-align:justify;margin-bottom:6mm;word-break:break-word;}
.f{padding:0 2px;font-weight:700;color:#1a1a1a;}
.purpose{margin-top:6mm;font-size:16pt;}
.sig-area{margin-top:8mm;display:flex;justify-content:flex-end;}
.sig-block{text-align:center;min-width:240px;}
.sig-date-lbl{font-size:16pt;margin-bottom:3mm;}
.sig-img-box{width:200px;height:72px;margin:2mm auto 2mm;display:flex;align-items:center;justify-content:center;}
.sig-img-box img{max-height:100%;max-width:100%;object-fit:contain;}
.sig-name{font-size:16pt;margin-top:2px;font-weight:bold;}
.sig-pos{font-size:16pt;}
.ftr{margin-top:auto;border-top:1px solid #ccc;padding-top:3mm;font-size:15pt;line-height:1.5;text-align:left;flex-shrink:0;}
</style>
</head>
<body>
<div class="page">
<div class="wm">HRBP INTERNAL</div>
<div class="hdr">
  <div class="co-name">${companyName}</div>
  <div class="co-address">${companyAddressPrint}</div>
</div>
<div class="id-box">${th ? 'เลขที่' : 'Ref. No.'}&nbsp;${docId}</div>
<div class="doc-title">${th ? tmpl.titleTH : tmpl.titleEN}</div>
<div class="body">
<p style="text-indent:2em;">
  ${th ? 'โดยหนังสือฉบับนี้ขอรับรองว่า' : 'This is to certify that'} <span class="f">${th ? emp.nameTH : emp.nameEN}</span>
  ${th ? 'รหัสพนักงาน' : 'Employee ID'} <span class="f">${emp.empCode}</span>
  ${th ? 'เป็นพนักงานของบริษัท' : 'is an employee of'} <span class="f">${th ? co.th : co.en}</span>
  ${th ? 'ปฏิบัติงานในตำแหน่ง' : 'Position'} <span class="f">${th ? emp.posTH : emp.posEN}</span>
  ${th ? 'ฝ่าย' : 'Department'} <span class="f">${th ? emp.deptTH : emp.deptEN}</span>
  ${th ? 'เริ่มทำงานตั้งแต่วันที่' : 'employed since'} <span class="f">${th ? emp.startTH : emp.startEN}</span>
  ${th ? 'ถึงปัจจุบัน' : 'to the present'}${tmpl.showSalary ? `
  ${th ? 'และได้รับอัตราเงินเดือนปัจจุบัน เดือนละ' : 'with a monthly salary of'} <span class="f">${$('cb-emp-salary')?.value || emp.salary}</span> ${th ? 'บาท' : 'THB'}` : ''}
</p>
<p class="purpose"><span style="font-weight:700;">${th ? 'หมายเหตุ :' : 'Remark:'}</span> <span style="margin-left:4px;">${rmkText && !rmkText.includes('เลือกหมายเหตุ') ? rmkText : '________________________________'}</span></p>
</div>
<div class="sig-area">
  <div class="sig-block">
    <div class="sig-date-lbl">${th ? 'ออกให้ ณ วันที่' : 'Issued on'} ${issueDate}</div>
    <div class="sig-img-box">${sigSrc ? `<img src="${sigSrc}" alt="Signature" />` : ''}</div>
    <div class="sig-name">( ${mgrName} )</div>
    <div class="sig-pos">${mgrPos}</div>
  </div>
</div>
<div class="ftr">
  <strong><em>${th ? 'ฝ่ายทรัพยากรมนุษย์' : 'Human Resources'}</em></strong><br/>
  ${th ? 'คุณ' : 'Khun '}${offName} โทร. 038-540330 / ${offPhone || '-'} / E-mail : ${offEmail || '-'}
</div>
</div>
</body>
</html>`;

    if (!openCertificatePrintWindow(html)) {
      toast('กรุณาอนุญาต Pop-up เพื่อพิมพ์ PDF', 'error');
    }
  };

  const handleClose = () => {
    ['cb-root', 'cb-toolbar', 'cb-sig-panel', 'cb-toast'].forEach((id) => {
      document.getElementById(id)?.remove();
    });
    navigate('/admin/dashboard');
  };

  const onToolbarClick = (e) => {
    const btn = e.target.closest('#cb-toolbar button');
    if (!btn?.id) return;
    e.preventDefault();
    switch (btn.id) {
      case 'cb-sig-panel-open':
        if (sigPanel && sigPanel.classList.contains('cb-sig-panel-open')) {
          closeSigPanel();
        } else {
          openSigPanel();
        }
        break;
      case 'cb-save-btn':
        handleSave();
        break;
      case 'cb-print-btn':
        handlePrint();
        break;
      case 'cb-close-btn':
        handleClose();
        break;
      default:
        break;
    }
  };

  const toolbarEl = $chrome('cb-toolbar');
  toolbarEl?.addEventListener('click', onToolbarClick);

  const sigPanelCloseBtn = document.querySelector('#cb-sig-panel #cb-sig-panel-close');
  sigPanelCloseBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    closeSigPanel();
  });

  buildSigPanel();

  if (container) {
    container.style.pointerEvents = 'auto';
  }

  return () => {
    document.removeEventListener('change', onCbChange);
    document.removeEventListener('blur', onCbBlur, true);
    toolbarEl?.removeEventListener('click', onToolbarClick);
  };
}
