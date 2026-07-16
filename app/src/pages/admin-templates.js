import { t, getLang } from '../lib/i18n.js';
import { getTemplates as apiGetTemplates, createTemplate, updateTemplate, deleteTemplate } from '../lib/api.js';
import { isEnglishTemplate } from '../lib/hrms-helper.js';

const TEMPLATE_EDITS_KEY = 'hrbp_template_edits';
const SYSTEM_UPDATED_BY = '__system__';

const CATEGORY_ICONS = {
  'หนังสือรับรองการทำงาน': 'description',
  'หนังสือรับรองเงินเดือน': 'receipt_long',
  'หนังสือรับรองเพื่อทำวีซ่า': 'flight_takeoff',
  'อื่นๆ': 'article',
};
const CATEGORIES = Object.keys(CATEGORY_ICONS);

let cachedTemplates = [];

function getTemplates() {
  return cachedTemplates;
}


function getEdits() {
  return JSON.parse(localStorage.getItem(TEMPLATE_EDITS_KEY) || '[]');
}

function addEdit(name) {
  const edits = getEdits();
  edits.unshift({ name, time: t('templates.justNow'), icon: CATEGORY_ICONS[Object.keys(CATEGORY_ICONS).find(k => name.includes(k))] || 'description' });
  if (edits.length > 10) edits.length = 10;
  localStorage.setItem(TEMPLATE_EDITS_KEY, JSON.stringify(edits));
}

// ── Shared CSS for certificate HTML ───────────────────────────────────────────
const CERT_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Angsana New', 'TH Sarabun New', 'Sarabun', serif; color: #1a1a1a; background: #fff; }
.cert-page { width: 210mm; height: 297mm; min-height: 297mm; max-height: 297mm; padding: 20mm 25mm 14mm; position: relative; background: #fff; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; }
@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; width: 210mm; height: 297mm; }
  .cert-page { width: 210mm !important; height: 297mm !important; min-height: 297mm !important; max-height: 297mm !important; padding: 20mm 25mm 14mm !important; page-break-inside: avoid !important; page-break-after: avoid !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
.header { text-align: center; margin-bottom: 8mm; border-bottom: 1px solid #1a1a1a; padding-bottom: 4mm; }
.header h1 { font-size: 20pt; font-weight: bold; line-height: 1.2; margin-bottom: 1px; }
.header .co-address { font-size: 16pt; line-height: 1.2; }
.header-en { text-align: left; }
.header-en h1 { text-align: left; font-size: 18pt; line-height: 1.25; }
.header-en .co-address { text-align: left; font-size: 15pt; line-height: 1.35; color: #1a1a1a; }
.header-en .co-hr-phone { text-align: left; font-size: 15pt; line-height: 1.35; margin-top: 1px; }
.cert-number-row { font-size: 16pt; margin-bottom: 6mm; text-align: right; font-weight: bold; }
.doc-title { font-size: 20pt; font-weight: 700; letter-spacing: 1px; margin-bottom: 8mm; text-align: center; }
.doc-title-en { font-size: 16pt; font-weight: 400; letter-spacing: 0; text-align: left; }
.body-text { font-size: 16pt; line-height: 1.75; text-align: justify; margin-bottom: 0; flex: 0 0 auto; }
.body-text .field { display: inline-block; border-bottom: 1px solid #1a1a1a; min-width: 150px; padding: 0 4px; font-weight: 700; text-align: center; vertical-align: baseline; line-height: 1.2; text-indent: 0; }
sup { font-size: 0.62em; vertical-align: super; line-height: 0; font-weight: 400; }
.purpose-line { margin-top: 8mm; font-size: 16pt; }
.salary-line { margin-top: 2px; }
.signature-area { margin-top: 8mm; margin-bottom: 0; padding-top: 0; flex-shrink: 0; display: flex; justify-content: flex-end; }
.signature-area .signer { text-align: center; min-width: 240px; }
.signature-area .issue-date { font-size: 16pt; margin-bottom: 2mm; }
.signature-area .signer .sig-name { font-weight: 700; font-size: 16pt; margin-top: 2px; }
.signature-area .signer .sig-pos { font-size: 16pt; }
.signature-area .signer .sig-greeting { font-size: 16pt; }
.footer { margin-top: auto; border-top: 1px solid #ccc; padding-top: 3mm; font-size: 15pt; line-height: 1.35; text-align: left; flex-shrink: 0; position: relative; z-index: 2; overflow: visible; page-break-inside: avoid; }
.cb-off-select-visible { font-family: inherit; font-size: 16pt; font-weight: bold; color: #1a73e8; border: none; border-bottom: 1.5px dashed #1a73e8; background: transparent; padding: 0 2px; margin: 0 2px; cursor: pointer; max-width: 100%; vertical-align: baseline; appearance: auto; -webkit-appearance: menulist; }
.cb-off-select-visible:focus { outline: 2px solid rgba(26,115,232,0.35); outline-offset: 1px; }
.watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 48pt; color: rgba(200,200,200,0.06); font-weight: 700; pointer-events: none; z-index: 0; }
.en-section { margin-top: 10mm; padding-top: 6mm; border-top: 2px dashed #ccc; }
.en-section h2 { font-size: 20pt; text-align: center; margin-bottom: 6mm; font-weight: 700; }
.cert-page-visa-abroad { padding: 18mm 28mm 16mm; height: 297mm; min-height: 297mm; max-height: 297mm; box-sizing: border-box; }
.cert-page-visa-abroad .header { margin-bottom: 4mm; padding-bottom: 2mm; }
.cert-page-visa-abroad .cert-number-row { margin-bottom: 3mm; }
.cert-page-visa-abroad .doc-title-en { margin-top: 4mm !important; margin-bottom: 6mm !important; }
.cert-page-visa-abroad .body-text { margin-bottom: 0; flex: 1; min-height: 0; }
.cert-page-visa-abroad .body-text p { margin-bottom: 2mm !important; }
.cert-page-visa-abroad .body-text p:last-child { margin-bottom: 0 !important; }
.cert-page-visa-abroad .signature-area { margin-top: auto !important; padding-top: 4mm; flex-shrink: 0; }
/* cert-screen-scroll */
@media screen {
  html, body { overflow: auto !important; height: auto !important; min-height: 100%; background: #e8e8e8; }
  .cert-page, .cert-page-visa-abroad {
    height: auto !important; min-height: 297mm; max-height: none !important;
    overflow: visible !important; margin: 16px auto; box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  }
  .cert-page-visa-abroad .body-text { flex: 0 0 auto !important; min-height: auto !important; overflow: visible !important; }
}
@media print {
  .cert-page-visa-abroad { height: auto; min-height: 100vh; max-height: none; }
}`;

// ── Per-type HTML template builders ───────────────────────────────────────────
function buildWorkCertTH() {
  return `<html><head><meta charset="utf-8"><style>${CERT_CSS}</style></head><body>
<div class="cert-page">
  <div class="watermark">HRBP INTERNAL</div>
  <div class="header">
    <h1>{{company_name}}</h1>
    <div class="co-address">{{company_address}}</div>
  </div>
  <div class="cert-number-row">HRBP {{cert_number}}</div>
  <div class="doc-title" style="margin-top:6mm;margin-bottom:8mm;">หนังสือรับรองการทำงาน</div>
  <div class="body-text">
    <p style="text-indent:48px;">
      โดยหนังสือฉบับนี้ขอรับรองว่า
      <span class="field" style="min-width:200px;">{{full_name}}</span>
      รหัสพนักงาน
      <span class="field" style="min-width:100px;">{{emp_id}}</span>
      เป็นพนักงานของบริษัท
      <span class="field" style="min-width:240px;">{{company_name}}</span>
      ปฏิบัติงานในตำแหน่ง
      <span class="field" style="min-width:150px;">{{position}}</span>
      ฝ่าย
      <span class="field" style="min-width:120px;">{{department}}</span>
      เริ่มทำงานตั้งแต่วันที่
      <span class="field" style="min-width:120px;">{{start_date}}</span>
      ถึงปัจจุบัน
    </p>
    <div class="purpose-line" style="margin-top:8mm;display:flex;align-items:baseline;gap:4px;flex-wrap:wrap;">
      <strong>หมายเหตุ :</strong>
      <span style="position:relative;display:inline-block;min-width:160px;">
        <span id="cb-rmk-text" contenteditable="true"
          style="border-bottom:1.5px dashed #1a73e8;color:#1a1a1a;font-weight:600;padding:0 4px;min-width:80px;outline:none;cursor:text;display:inline-block;"
          title="เลือกจากรายการหรือพิมพ์แก้ไขเอง">{{purpose}}</span>
        <select id="cb-rmk-select"
          style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;z-index:2;"
          aria-label="เลือกหมายเหตุ">
          <option value="">—</option>
        </select>
      </span>
    </div>
  </div>
  <div class="signature-area">
    <div class="signer" style="text-align:center;min-width:250px;">
      <div class="issue-date" style="margin-bottom:1.5mm;">
        ออกให้ ณ วันที่
        <span id="cb-issue-date" contenteditable="true"
          style="border-bottom:1.5px dashed #1a73e8;color:#1a73e8;font-weight:600;padding:0 4px;min-width:60px;outline:none;cursor:text;">{{issue_date}}</span>
      </div>
      <div id="cb-sig-box" style="width:200px;height:68px;margin:0 auto 1mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">{{hr_signer_signature}}</div>
      <div style="position:relative;display:inline-block;width:100%;margin-top:0;">
        <div id="cb-mgr-display" title="คลิกเพื่อเลือกผู้ลงนาม"
          style="font-size:16pt;font-weight:bold;color:#1a73e8;border-bottom:1.5px dashed #1a73e8;cursor:pointer;">
          (&nbsp;<span id="cb-mgr-name">{{hr_signer_name}}</span>&nbsp;)
        </div>
        <select id="cb-mgr-select"
          style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;"
          aria-label="Select HR Manager">
          <option value="">— เลือกผู้มีอำนาจลงนาม —</option>
        </select>
      </div>
      <div class="sig-pos" id="cb-mgr-pos" style="font-size:16pt;margin-top:0;">{{hr_signer_position}}</div>
    </div>
  </div>
  <div class="footer cb-cert-footer">
    <strong><em>ฝ่ายทรัพยากรมนุษย์</em></strong><br/>
    <span id="cb-footer-label">คุณ</span><select id="cb-off-select" class="cb-off-select-visible" aria-label="เลือก HRBP">
      <option value="">— เลือก HRBP —</option>
    </select><span id="cb-off-name" hidden aria-hidden="true">{{hr_officer_name}}</span>
    &nbsp;โทร. 038-540330 / <span id="cb-off-phone">{{hr_officer_phone}}</span> / E-mail : <span id="cb-off-email">{{hr_officer_email}}</span>
  </div>
</div>
</body></html>`;
}

function buildWorkCertEN() {
  return `<html><head><meta charset="utf-8"><style>${CERT_CSS}</style></head><body>
<div class="cert-page">
  <div class="watermark">HRBP INTERNAL</div>
  <div class="header header-en">
    <h1>{{company_name_en}}</h1>
    <div class="co-address">{{company_address_en}}</div>
    <div class="co-hr-phone">
      Tel :
      <span style="position:relative;display:inline-block;">
        <span id="cb-header-hr-phone" title="Click to select HR contact" style="font-weight:bold;color:#1a73e8;border-bottom:1.5px dashed #1a73e8;padding:0 4px;cursor:pointer;">{{hr_officer_phone_intl}}</span>
        <select id="cb-header-hr-select" style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;" aria-label="Select HR Officer Phone"></select>
      </span>
    </div>
  </div>
  <div class="cert-number-row" style="text-align:justify;display:flex;justify-content:space-between;width:100%;">
    <span>HRBP {{cert_number}}</span>
    <span>Date: {{issue_date_en}}</span>
  </div>
  <div class="doc-title doc-title-en" style="margin-top:10mm;margin-bottom:15mm;">To Whom It May Concern,</div>
  <div class="body-text">
    <p style="text-indent:48px;margin-bottom:6mm;">
      This letter is to certify that <span class="field" style="min-width:200px;">{{full_name_en}}</span> currently employed by <span class="field" style="min-width:240px;">{{company_name_en}}</span> as <span class="field" style="min-width:180px;">{{position}}</span>. {{gender_subject}} has been working with the company since <span class="field" style="min-width:120px;">{{start_date_en}}</span> - Present.
    </p>
    <p style="text-indent:48px;margin-bottom:6mm;">
      Should you require any information regarding the above, please do not hesitate to contact us.
    </p>
  </div>
  <div class="signature-area" style="margin-top:15mm;justify-content:flex-start;">
    <div class="signer" style="text-align:left;min-width:300px;">
      <div class="sig-greeting">Sincerely yours,</div>
      <div style="height:50px;"></div>
      <div id="cb-sig-box" style="width:200px;height:68px;margin:0;padding:0;display:flex;align-items:flex-end;justify-content:flex-start;overflow:hidden;">{{hr_signer_signature}}</div>
      <div style="position:relative;display:inline-block;width:100%;margin-top:0;">
        <div id="cb-mgr-display" title="Click to select signer"
          style="font-size:16pt;font-weight:bold;color:#1a73e8;border-bottom:1.5px dashed #1a73e8;cursor:pointer;">
          (&nbsp;<span id="cb-mgr-name">{{hr_signer_name}}</span>&nbsp;)
        </div>
        <select id="cb-mgr-select"
          style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;"
          aria-label="Select HR Manager">
          <option value="">— Select Signer —</option>
        </select>
      </div>
      <div class="sig-pos" id="cb-mgr-pos" style="font-size:16pt;margin-top:0;">{{hr_signer_position}}</div>
      <div style="font-size:16pt;margin-top:2px;">Tel : <span id="cb-mgr-phone">{{hr_signer_phone_intl}}</span></div>
    </div>
  </div>
  <div class="footer">
    <strong>Remark:</strong> {{company_name_en}} is an affiliated company of Double A (1991) Public Company Limited.
  </div>
</div>
</body></html>`;
}

function buildVisaAbroadEN() {
  return `<html><head><meta charset="utf-8"><style>${CERT_CSS}</style></head><body>
<div class="cert-page cert-page-visa-abroad">
  <div class="watermark">HRBP INTERNAL</div>
  <div class="header header-en">
    <h1>{{company_name_en}}</h1>
    <div class="co-address">{{company_address_en}}</div>
    <div class="co-hr-phone">
      Tel :
      <span style="position:relative;display:inline-block;">
        <span id="cb-header-hr-phone" title="Click to select HR contact" style="font-weight:bold;color:#1a73e8;border-bottom:1.5px dashed #1a73e8;padding:0 4px;cursor:pointer;">{{hr_officer_phone_intl}}</span>
        <select id="cb-header-hr-select" style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;" aria-label="Select HR Officer Phone"></select>
      </span>
    </div>
  </div>
  <div class="cert-number-row" style="text-align:justify;display:flex;justify-content:space-between;width:100%;">
    <span>HRBP {{cert_number}}</span>
    <span>Date: {{issue_date_en}}</span>
  </div>
  <div class="doc-title doc-title-en">To Whom It May Concern,</div>
  <div class="body-text">
    <p style="text-indent:48px;">
      This letter is to certify that <span class="field" style="min-width:200px;">{{full_name_en}}</span> currently employed by <span class="field" style="min-width:240px;">{{company_name_en}}</span> as <span class="field" style="min-width:180px;">{{position}}</span>. {{gender_subject}} has been working with the company since <span class="field" style="min-width:120px;">{{start_date_en}}</span> to present. {{gender_possessive}} average salary is <span class="field" style="min-width:100px;">{{salary_amount}}</span> Baht per month.
    </p>
    <p style="text-indent:48px;">
      <span class="field" style="min-width:200px;">{{full_name_en}}</span> will have a business trip to <span class="field" style="min-width:120px;">{{visa_country}}</span> between <span class="field" style="min-width:120px;">{{abroad_start_date_en}}</span> – <span class="field" style="min-width:120px;">{{abroad_end_date_en}}</span>. During {{gender_reflexive_lc}} stay in <span class="field" style="min-width:120px;">{{visa_country}}</span> all the expenses shall be provided by the company and {{gender_subject_lc}} will still receive {{gender_reflexive_lc}} salary from the company as usual. Moreover, {{gender_reflexive_lc}} assigned job is not related to {{gender_reflexive_lc}} own advantage. After finishing {{gender_reflexive_lc}} mission, {{gender_subject_lc}} will be back to resume {{gender_reflexive_lc}} work.
    </p>
    <p style="text-indent:48px;">
      Any assistance extended to <span class="field" style="min-width:200px;">{{full_name_en}}</span> in granting business visa is highly appreciated.
    </p>
  </div>
  <div class="signature-area" style="justify-content:flex-start;">
    <div class="signer" style="text-align:left;min-width:300px;">
      <div class="sig-greeting">Sincerely yours,</div>
      <div style="height:28px;"></div>
      <div id="cb-sig-box" style="width:200px;height:68px;margin:0;padding:0;display:flex;align-items:flex-end;justify-content:flex-start;overflow:hidden;">{{hr_signer_signature}}</div>
      <div style="position:relative;display:inline-block;width:100%;margin-top:0;">
        <div id="cb-mgr-display" title="Click to select signer"
          style="font-size:16pt;font-weight:bold;color:#1a73e8;border-bottom:1.5px dashed #1a73e8;cursor:pointer;">
          (&nbsp;<span id="cb-mgr-name">{{hr_signer_name}}</span>&nbsp;)
        </div>
        <select id="cb-mgr-select"
          style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;"
          aria-label="Select HR Manager">
          <option value="">— Select Signer —</option>
        </select>
      </div>
      <div class="sig-pos" id="cb-mgr-pos" style="font-size:16pt;margin-top:0;">{{hr_signer_position}}</div>
      <div style="font-size:16pt;margin-top:2px;">Tel : <span id="cb-mgr-phone">{{hr_signer_phone_intl}}</span></div>
    </div>
  </div>
</div>
</body></html>`;
}

async function patchWorkCertTemplates(existing) {
  const patches = [
    { id: 'tpl-work-th', content: buildWorkCertTH(), version: 'V 1.8' },
    { id: 'tpl-work-en', content: buildWorkCertEN(), version: 'V 2.1' },
    { id: 'tpl-visa-abroad', content: buildVisaAbroadEN(), version: 'V 2.1' },
  ];
  for (const patch of patches) {
    const tmpl = existing.find(t => t.id === patch.id);
    if (tmpl) {
      await updateTemplate(patch.id, { ...tmpl, content: patch.content, version: patch.version });
    }
  }
}

export async function seedTemplates() {
  try {
    const res = await apiGetTemplates();
    let existing = res.data || res || [];
    // Clear and re-seed if the templates list is not exactly our 3 templates
    const hasCorrectTemplates = existing.length === 3 && existing.every(t => ['tpl-work-th', 'tpl-work-en', 'tpl-visa-abroad'].includes(t.id));
    if (!hasCorrectTemplates) {
      // Force clear client-side mock fallback
      localStorage.removeItem('hrbp_templates');
      
      const now = new Date();
      const defaultTemplates = [
        { id: 'tpl-work-th', name: 'หนังสือรับรองการทำงาน (Thai)', version: 'V 1.1', category: 'หนังสือรับรองการทำงาน', status: 'published', statusLabel: t('status.published'), updatedAt: now.toISOString(), updatedBy: SYSTEM_UPDATED_BY, updated_by: SYSTEM_UPDATED_BY, icon: 'description', content: buildWorkCertTH() },
        { id: 'tpl-work-en', name: 'หนังสือรับรองการทำงาน (Eng)', version: 'V 1.1', category: 'หนังสือรับรองการทำงาน', status: 'published', statusLabel: t('status.published'), updatedAt: now.toISOString(), updatedBy: SYSTEM_UPDATED_BY, updated_by: SYSTEM_UPDATED_BY, icon: 'description', content: buildWorkCertEN() },
        { id: 'tpl-visa-abroad', name: 'หนังสือรับรองกรณีส่งพนักงานทำงานไปต่างประเทศ (Eng)', version: 'V 1.0', category: 'หนังสือรับรองเพื่อทำวีซ่า', status: 'published', statusLabel: t('status.published'), updatedAt: now.toISOString(), updatedBy: SYSTEM_UPDATED_BY, updated_by: SYSTEM_UPDATED_BY, icon: 'flight_takeoff', content: buildVisaAbroadEN() },
      ];
      
      // Seed them
      for (const tmpl of defaultTemplates) {
        await createTemplate(tmpl);
      }
      
      const reRes = await apiGetTemplates();
      existing = reRes.data || reRes || [];
    } else {
      await patchWorkCertTemplates(existing);
      const reRes = await apiGetTemplates();
      existing = reRes.data || reRes || [];
    }

    cachedTemplates = existing;
  } catch (e) {
    console.error('Failed to seed templates:', e);
  }
}

function nextId() {
  const list = getTemplates();
  const max = list.reduce((m, t) => Math.max(m, parseInt((t.id || 't0').replace('t', ''), 10) || 0), 0);
  return 't' + (max + 1);
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const months = t('month.short');
  const year = getLang() === 'th' ? d.getFullYear() + 543 : d.getFullYear();
  return `${d.getDate()} ${months[d.getMonth()]} ${year}`;
}

function formatUpdatedBy(value) {
  if (!value) return '-';
  const v = String(value).trim();
  if (v === SYSTEM_UPDATED_BY || v.toLowerCase() === 'system' || v === 'ระบบ') {
    return t('common.system');
  }
  return v;
}

export function renderAdminTemplates() {
  const templates = getTemplates();
  const edits = getEdits();

  const totalActive = templates.filter(t => t.status === 'published').length;
  const totalIssued = templates.length;


  return `
    <div class="flex justify-between items-end mb-8">
      <div>
        <h2 class="page-title">${t('templates.pageTitle')}</h2>
        <p class="page-subtitle">${t('templates.pageSubtitle')}</p>
      </div>
      <div class="flex gap-3 flex-wrap justify-end">
        <button class="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 transition-opacity shadow-md" id="btn-create-template">
          <span class="material-symbols-outlined text-[18px]">add</span>
          ${t('templates.createBtn')}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <div class="lg:col-span-2 bg-primary rounded-xl px-5 py-4 text-on-primary relative overflow-hidden shadow-lg">
        <span class="material-symbols-outlined absolute -right-2 -bottom-4 text-[110px] text-white opacity-10 pointer-events-none" style="font-variation-settings: 'FILL' 1;">description</span>
        <div class="relative z-10">
          <span class="inline-block px-2.5 py-0.5 bg-white/20 rounded-full text-[10px] font-bold mb-2 tracking-wider uppercase">${t('templates.statusOverview')}</span>
          <h2 class="text-xl font-display font-bold leading-tight mb-1">${t('templates.heroActive', { count: totalActive })}</h2>
          <p class="text-white/80 text-label-sm max-w-md">${t('templates.heroSub')}</p>
          <div class="flex gap-6 mt-3 pt-3 border-t border-white/20">
            <div>
              <p class="hero-stat-value text-xl font-bold leading-none mb-0.5">85%</p>
              <p class="text-[10px] text-white/70 uppercase tracking-widest">${t('templates.statSatisfaction')}</p>
            </div>
            <div class="w-px bg-white/20"></div>
            <div>
              <p class="hero-stat-value text-xl font-bold leading-none mb-0.5">${totalIssued}</p>
              <p class="text-[10px] text-white/70 uppercase tracking-widest">${t('templates.statTotal')}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant shadow-sm flex flex-col">
        <h3 class="text-label-lg font-bold text-on-surface mb-3">${t('templates.recentEdits')}</h3>
        <div class="flex-1 flex flex-col gap-3">
          ${edits.length ? edits.map(edit => `
            <div class="flex items-center gap-3 group cursor-pointer">
              <div class="w-9 h-9 rounded-lg bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary-container transition-colors">
                <span class="material-symbols-outlined">${edit.icon}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-label-md font-bold text-on-surface truncate group-hover:text-primary transition-colors">${edit.name}</p>
                <p class="text-label-sm text-outline">${edit.time}</p>
              </div>
              <span class="material-symbols-outlined text-outline group-hover:text-primary transition-colors">chevron_right</span>
            </div>
          `).join('') : `<p class="text-label-sm text-outline">${t('templates.noEdits')}</p>`}
        </div>
      </div>
    </div>

    <div class="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      <div class="p-4 border-b border-outline-variant flex flex-col md:flex-row justify-between items-center gap-4 bg-surface-container-low/50">
        <div class="flex items-center gap-6">
          <h3 class="text-headline-md font-bold text-on-surface px-2">${t('templates.tableTitle')}</h3>
          <div class="flex gap-2" id="template-tabs">
            <button class="tab-filter px-4 py-1.5 bg-surface text-primary font-bold text-label-sm rounded border border-outline-variant/50 shadow-sm" data-status="">${t('templates.tabAll')}</button>
            <button class="tab-filter px-4 py-1.5 text-on-surface-variant font-medium text-label-sm hover:bg-surface-container rounded transition-colors" data-status="draft">${t('templates.tabDraft')}</button>
            <button class="tab-filter px-4 py-1.5 text-on-surface-variant font-medium text-label-sm hover:bg-surface-container rounded transition-colors" data-status="published">${t('templates.tabPublished')}</button>
            <button class="tab-filter px-4 py-1.5 text-on-surface-variant font-medium text-label-sm hover:bg-surface-container rounded transition-colors" data-status="disabled">${t('templates.tabDisabled')}</button>
          </div>
        </div>
        <div class="relative w-full md:w-64">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
          <input id="template-search" class="w-full bg-white border border-outline-variant rounded-lg pl-9 pr-4 py-1.5 text-label-md focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all" placeholder="${t('templates.searchPlaceholder')}" type="text" />
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-outline-variant bg-surface-container-lowest">
              <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant font-display">${t('templates.tableName')}</th>
              <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant font-display">${t('templates.tableCategory')}</th>
              <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant font-display">${t('templates.tableStatus')}</th>
              <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant font-display">${t('templates.tableUpdated')}</th>
              <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant font-display text-right">${t('templates.tableAction')}</th>
            </tr>
          </thead>
          <tbody id="template-tbody" class="divide-y divide-outline-variant"></tbody>
        </table>
      </div>

      <div id="template-pagination" class="p-4 border-t border-outline-variant flex justify-between items-center bg-surface-container-lowest"></div>
    </div>

    <!-- Create/Edit Modal -->
    <div id="template-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 hidden">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="template-modal-backdrop"></div>
      <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div class="h-1.5 bg-primary w-full shrink-0"></div>
        <div class="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-primary">description</span>
            <h3 class="text-title-md font-bold text-on-surface" id="template-modal-title">${t('templates.modalCreateTitle')}</h3>
          </div>
          <button id="template-modal-close" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-outline transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div class="px-6 pb-6 overflow-y-auto">
          <input type="hidden" id="template-edit-id" />
          <div class="space-y-5">
            <div>
              <label class="block text-label-md font-semibold text-on-surface-variant mb-2">${t('templates.labelName')} <span class="text-error">*</span></label>
              <input id="field-name" class="w-full bg-white border border-outline-variant rounded-xl px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-on-surface font-medium" placeholder="${t('templates.namePlaceholder')}" />
            </div>
            <div>
              <label class="block text-label-md font-semibold text-on-surface-variant mb-2">${t('templates.labelCategory')} <span class="text-error">*</span></label>
              <select id="field-category" class="w-full bg-white border border-outline-variant rounded-xl px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-on-surface font-medium">
                <option value="">${t('templates.categoryDefault')}</option>
                ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-label-md font-semibold text-on-surface-variant mb-2">${t('templates.tableStatus')}</label>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="template-status" value="draft" checked class="accent-primary" />
                  <span class="text-label-md text-on-surface">${t('templates.tabDraft')}</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="template-status" value="published" class="accent-primary" />
                  <span class="text-label-md text-on-surface">${t('templates.tabPublished')}</span>
                </label>
              </div>
            </div>
            <div>
              <label class="block text-label-md font-semibold text-on-surface-variant mb-2">${t('templates.labelHtml')}</label>
              <textarea id="field-content" class="w-full bg-white border border-outline-variant rounded-xl px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-on-surface font-mono text-label-sm" rows="8" placeholder="${t('templates.htmlPlaceholder')}"></textarea>
              <p class="text-label-xs text-outline mt-1.5">${t('templates.htmlHint')}</p>
            </div>
          </div>
          <div class="flex gap-3 mt-8">
            <button id="template-modal-cancel" class="flex-1 py-3 border border-outline-variant text-on-surface-variant font-bold rounded-xl hover:bg-surface-container transition-colors">${t('common.cancel')}</button>
            <button id="template-modal-save" class="flex-[2] py-3 bg-primary text-on-primary font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[18px]">save</span>
              ${t('templates.saveBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>

  `;
}

async function renderTemplateTable(container) {
  try {
    const res = await apiGetTemplates();
    cachedTemplates = res.data || res || [];
  } catch (e) {
    console.error('Failed to load templates:', e);
  }

  const templates = cachedTemplates;

  // Update DOM stats dynamically since the shell is already rendered with old/zero stats
  const totalActive = templates.filter(t => t.status === 'published').length;
  const totalIssued = templates.length;

  const heroEl = container.querySelector('.lg\\:col-span-2 h2');
  if (heroEl) {
    heroEl.textContent = t('templates.heroActive', { count: totalActive });
  }
  const statEls = container.querySelectorAll('.lg\\:col-span-2 .hero-stat-value');
  if (statEls.length >= 2) {
    statEls[1].textContent = totalIssued;
  }

  const filterStatus = sessionStorage.getItem('template-filter') || '';
  const search = (sessionStorage.getItem('template-search') || '').toLowerCase();
  const page = parseInt(sessionStorage.getItem('template-page') || '1');
  const perPage = 5;

  let filtered = templates;
  if (filterStatus) filtered = filtered.filter(t => t.status === filterStatus);
  if (search) filtered = filtered.filter(t => t.name.toLowerCase().includes(search));


  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  const tbody = container.querySelector('#template-tbody');
  if (!tbody) return;

  if (!pageItems.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-on-surface-variant">${t('templates.emptyTitle')}</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(tmpl => {
      let badgeClass = 'bg-surface-container-highest text-on-surface-variant';
      let dotClass = 'bg-outline-variant';
      if (tmpl.status === 'published') { badgeClass = 'bg-[#dcfce7] text-[#166534]'; dotClass = 'bg-[#166534]'; }
      else if (tmpl.status === 'disabled') { badgeClass = 'bg-surface-container-highest text-outline'; dotClass = 'bg-outline'; }
      const isDisabled = tmpl.status === 'disabled';
      return `
        <tr class="hover:bg-surface-container-low transition-colors group ${isDisabled ? 'opacity-60' : ''}" data-id="${tmpl.id}">
          <td class="px-6 py-4">
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded bg-primary-fixed/50 text-primary flex items-center justify-center border border-primary/10 shrink-0 group-hover:bg-primary-fixed transition-colors">
                <span class="material-symbols-outlined text-[20px]">${tmpl.icon || CATEGORY_ICONS[tmpl.category] || 'description'}</span>
              </div>
              <div>
                <p class="text-label-md font-bold text-on-surface group-hover:text-primary transition-colors">${tmpl.name}</p>
                <p class="text-[11px] text-outline mt-0.5">${tmpl.version}</p>
              </div>
            </div>
          </td>
          <td class="px-6 py-4 text-label-md text-on-surface-variant">${tmpl.category}</td>
          <td class="px-6 py-4">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${badgeClass}">
              <span class="w-1.5 h-1.5 rounded-full ${dotClass}"></span>
              ${tmpl.statusLabel || (tmpl.status === 'published' ? t('status.published') : tmpl.status === 'disabled' ? t('status.disabled') : t('status.draft'))}
            </span>
          </td>
          <td class="px-6 py-4">
            <p class="text-label-md text-on-surface">${formatDate(tmpl.updatedAt || tmpl.updated_at)}</p>
            <p class="text-[11px] text-outline mt-0.5">${t('templates.updatedBy')} ${formatUpdatedBy(tmpl.updatedBy || tmpl.updated_by)}</p>
          </td>
          <td class="px-6 py-4 text-right">
            <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button type="button" class="btn-template-preview p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="ดูตัวอย่าง HTML" data-id="${tmpl.id}">
                <span class="material-symbols-outlined text-[18px]">preview</span>
              </button>
              <button class="btn-template-edit p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="${t('common.edit')}" data-id="${tmpl.id}">
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>
              ${isDisabled ? `
              <button class="btn-template-enable p-2 text-[#166534] hover:bg-[#dcfce7] rounded-lg transition-colors" title="${t('common.enable')}" data-id="${tmpl.id}">
                <span class="material-symbols-outlined text-[18px]">check_circle</span>
              </button>
              ` : `
              <button class="btn-template-disable p-2 text-outline hover:bg-surface-container-highest rounded-lg transition-colors" title="${t('common.disable')}" data-id="${tmpl.id}">
                <span class="material-symbols-outlined text-[18px]">visibility_off</span>
              </button>
              `}
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  const pagination = container.querySelector('#template-pagination');
  if (pagination) {
    pagination.innerHTML = `
      <p class="text-label-sm text-outline">${t('common.showing')} ${start + 1} ${t('common.to')} ${Math.min(start + perPage, filtered.length)} ${t('common.from')} ${filtered.length} ${t('common.items')}</p>
      <div class="flex gap-1 items-center">
        <button class="btn-template-page p-1 text-outline hover:text-primary transition-colors ${safePage <= 1 ? 'opacity-30 cursor-not-allowed' : ''}" data-page="${safePage - 1}" ${safePage <= 1 ? 'disabled' : ''}>
          <span class="material-symbols-outlined">chevron_left</span>
        </button>
        ${Array.from({length: totalPages}, (_, i) => i + 1).map(p => `
          <button class="btn-template-page w-8 h-8 rounded text-label-sm font-bold transition-colors ${p === safePage ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}" data-page="${p}">${p}</button>
        `).join('')}
        <button class="btn-template-page p-1 text-outline hover:text-primary transition-colors ${safePage >= totalPages ? 'opacity-30 cursor-not-allowed' : ''}" data-page="${safePage + 1}" ${safePage >= totalPages ? 'disabled' : ''}>
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
      </div>`;
  }
}

let templatePreviewWin = null;

function buildTemplatePreviewHtml(content, tmpl) {
  const en = isEnglishTemplate(tmpl);
  const samples = en ? {
    company_name: 'Mango Group Public Company Limited',
    company_name_en: 'Mango Group Public Company Limited',
    company_address: '123 Siripinyo Building, 8th Floor, Sri Ayutthaya Road, Ratchathewi, Bangkok 10400',
    company_address_en: '123 Siripinyo Building, 8th Floor, Sri Ayutthaya Road, Ratchathewi, Bangkok 10400',
    full_name: 'Alex Rivera',
    full_name_en: 'Alex Rivera',
    position: 'Senior Product Designer',
    department: 'User Experience Design',
    start_date: '1 January 2020',
    start_date_en: 'January 1<sup>st</sup>, 2020',
    issue_date: '1 July 2025',
    issue_date_en: 'July 1<sup>st</sup>, 2025',
    purpose: 'For bank loan application',
    hr_signer_name: 'Napaporn Jaisawang',
    hr_signer_position: 'HR Department Manager',
    hr_officer_name: 'Wipada Raksa-tham',
    gender_subject: 'She',
    gender_possessive: 'Her',
    gender_object: 'her',
    gender_reflexive: 'her',
    gender_subject_lc: 'she',
    gender_possessive_lc: 'her',
    gender_object_lc: 'her',
    gender_reflexive_lc: 'her',
    abroad_start_date_en: 'March 1<sup>st</sup>, 2026',
    abroad_end_date_en: 'March 15<sup>th</sup>, 2026',
  } : {
    company_name: 'บริษัท แมงโก้ กรุ๊ป จำกัด (มหาชน)',
    company_name_en: 'Mango Group Public Company Limited',
    company_address: '123 อาคารสิริภิญโญ ชั้น 8 ถนนศรีอยุธยา แขวงถนนพญาไท เขตราชเทวี กรุงเทพมหานคร 10400',
    company_address_en: '123 Siripinyo Building, 8th Floor, Sri Ayutthaya Road, Ratchathewi, Bangkok 10400',
    full_name: 'นายสมชาย ใจดี',
    full_name_en: 'Mr. Somchai Jaidee',
    position: 'นักพัฒนาซอฟต์แวร์อาวุโส',
    department: 'เทคโนโลยีสารสนเทศ',
    start_date: '1 มกราคม พ.ศ. 2563',
    start_date_en: 'January 1<sup>st</sup>, 2020',
    issue_date: '1 กรกฎาคม พ.ศ. 2568',
    issue_date_en: 'July 1<sup>st</sup>, 2025',
    purpose: 'เพื่อใช้เป็นหลักฐานประกอบการยื่นกู้ธนาคาร',
    hr_signer_name: 'นางสาวนภาพร ใจสว่าง',
    hr_signer_position: 'ผู้จัดการฝ่ายทรัพยากรมนุษย์',
    hr_officer_name: 'วิภาดา รักษาธรรม',
    gender_subject: 'He',
    gender_possessive: 'His',
    gender_object: 'him',
    gender_reflexive: 'his',
    gender_subject_lc: 'he',
    gender_possessive_lc: 'his',
    gender_object_lc: 'him',
    gender_reflexive_lc: 'his',
    abroad_start_date_en: 'March 1<sup>st</sup>, 2026',
    abroad_end_date_en: 'March 15<sup>th</sup>, 2026',
  };

  return content
    .replace(/\{\{company_name\}\}/g, samples.company_name)
    .replace(/\{\{company_name_en\}\}/g, samples.company_name_en)
    .replace(/\{\{company_address\}\}/g, samples.company_address)
    .replace(/\{\{company_address_en\}\}/g, samples.company_address_en)
    .replace(/\{\{cert_number\}\}/g, '0001/2568')
    .replace(/\{\{full_name\}\}/g, samples.full_name)
    .replace(/\{\{full_name_en\}\}/g, samples.full_name_en)
    .replace(/\{\{gender_subject\}\}/g, samples.gender_subject)
    .replace(/\{\{gender_possessive\}\}/g, samples.gender_possessive)
    .replace(/\{\{gender_object\}\}/g, samples.gender_object)
    .replace(/\{\{gender_reflexive\}\}/g, samples.gender_reflexive)
    .replace(/\{\{gender_subject_lc\}\}/g, samples.gender_subject_lc)
    .replace(/\{\{gender_possessive_lc\}\}/g, samples.gender_possessive_lc)
    .replace(/\{\{gender_object_lc\}\}/g, samples.gender_object_lc)
    .replace(/\{\{gender_reflexive_lc\}\}/g, samples.gender_reflexive_lc)
    .replace(/\{\{emp_id\}\}/g, 'EMP-2024-0001')
    .replace(/\{\{position\}\}/g, samples.position)
    .replace(/\{\{department\}\}/g, samples.department)
    .replace(/\{\{start_date\}\}/g, samples.start_date)
    .replace(/\{\{start_date_en\}\}/g, samples.start_date_en)
    .replace(/\{\{issue_date\}\}/g, samples.issue_date)
    .replace(/\{\{issue_date_en\}\}/g, samples.issue_date_en)
    .replace(/\{\{salary_amount\}\}/g, '50,000')
    .replace(/\{\{visa_country\}\}/g, 'Japan')
    .replace(/\{\{abroad_start_date_en\}\}/g, samples.abroad_start_date_en)
    .replace(/\{\{abroad_end_date_en\}\}/g, samples.abroad_end_date_en)
    .replace(/\{\{purpose\}\}/g, samples.purpose)
    .replace(/\{\{hr_signer_name\}\}/g, samples.hr_signer_name)
    .replace(/\{\{hr_signer_position\}\}/g, samples.hr_signer_position)
    .replace(/\{\{hr_officer_name\}\}/g, samples.hr_officer_name)
    .replace(/\{\{hr_officer_phone\}\}/g, '081-234-5678')
    .replace(/\{\{hr_officer_phone_intl\}\}/g, '+66 81 234 5678')
    .replace(/\{\{hr_signer_phone_intl\}\}/g, '+66 82 222 2222')
    .replace(/\{\{hr_officer_email\}\}/g, 'wipada.r@company.com');
}

/** Keep stored tpl-work-th editables in sync when certificate builder loads */
export function syncWorkThTemplateInStorage() {
  try {
    const all = JSON.parse(localStorage.getItem('hrbp_templates') || '[]');
    const idx = all.findIndex(t => t.id === 'tpl-work-th');
    if (idx === -1) return;
    const content = all[idx].content || '';
    const hasEditableControls = content.includes('id="cb-rmk-text"') && content.includes('id="cb-mgr-select"');
    const hasVisibleOffSelect = content.includes('cb-off-select-visible');
    const hasFullRmkSelect = content.includes('id="cb-rmk-select"') && content.includes('inset:0');
    const hasSigPlaceholder = content.includes('{{hr_signer_signature}}');
    const hasSinglePagePrint = content.includes('max-height: 297mm') && content.includes('page-break-inside: avoid');
    const hasSigLayoutV18 = content.includes('flex: 0 0 auto') && content.includes('height:68px');
    if (hasEditableControls && hasVisibleOffSelect && hasFullRmkSelect && hasSigPlaceholder && hasSinglePagePrint && hasSigLayoutV18) return;
    all[idx] = { ...all[idx], content: buildWorkCertTH(), version: 'V 1.8' };
    localStorage.setItem('hrbp_templates', JSON.stringify(all));
  } catch (_) {}
}

/** Keep stored tpl-work-en in sync when certificate builder loads */
export function syncWorkEnTemplateInStorage() {
  try {
    const all = JSON.parse(localStorage.getItem('hrbp_templates') || '[]');
    const idx = all.findIndex(t => t.id === 'tpl-work-en');
    if (idx === -1) return;
    const content = all[idx].content || '';
    if (content.includes('cb-mgr-select')) return;
    all[idx] = { ...all[idx], content: buildWorkCertEN(), version: 'V 2.0' };
    localStorage.setItem('hrbp_templates', JSON.stringify(all));
  } catch (_) {}
}

/** Keep stored tpl-visa-abroad in sync with work-en features */
export function syncVisaAbroadTemplateInStorage() {
  try {
    const all = JSON.parse(localStorage.getItem('hrbp_templates') || '[]');
    const idx = all.findIndex(t => t.id === 'tpl-visa-abroad');
    if (idx === -1) return;
    const content = all[idx].content || '';
    if (content.includes('cb-mgr-select')) return;
    all[idx] = { ...all[idx], content: buildVisaAbroadEN(), version: 'V 2.0' };
    localStorage.setItem('hrbp_templates', JSON.stringify(all));
  } catch (_) {}
}

function openTemplatePreviewWindow(html) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  if (templatePreviewWin && !templatePreviewWin.closed) {
    try {
      templatePreviewWin.location.replace(url);
      templatePreviewWin.focus();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return true;
    } catch {
      templatePreviewWin = null;
    }
  }

  templatePreviewWin = window.open(url, 'hrbp_template_preview', 'width=960,height=760');
  if (!templatePreviewWin) {
    URL.revokeObjectURL(url);
    return false;
  }
  templatePreviewWin.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
  templatePreviewWin.focus();
  return true;
}

export async function initAdminTemplates(container) {
  container._templatesAbort?.abort();
  const ac = new AbortController();
  container._templatesAbort = ac;
  const { signal } = ac;

  await seedTemplates();
  if (signal.aborted) return () => ac.abort();
  await renderTemplateTable(container);
  if (signal.aborted) return () => ac.abort();

  const showToast = (msg, icon = 'check_circle') => {
    const existing = container.querySelector('#template-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'template-toast';
    el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200]';
    el.innerHTML = `<div class="flex items-center gap-3 bg-on-surface text-inverse-on-surface px-5 py-3 rounded-xl shadow-xl text-label-md font-bold min-w-[260px] max-w-sm"><span class="material-symbols-outlined text-[20px] shrink-0">${icon}</span><span>${msg}</span></div>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  };

  // ── Tab Filter ──
  container.querySelectorAll('.tab-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-filter').forEach(b => {
        b.className = 'tab-filter px-4 py-1.5 text-on-surface-variant font-medium text-label-sm hover:bg-surface-container rounded transition-colors';
      });
      btn.className = 'tab-filter px-4 py-1.5 bg-surface text-primary font-bold text-label-sm rounded border border-outline-variant/50 shadow-sm';
      sessionStorage.setItem('template-filter', btn.getAttribute('data-status') || '');
      sessionStorage.setItem('template-page', '1');
      renderTemplateTable(container);
    }, { signal });
  });

  // ── Search ──
  let searchTimer;
  container.querySelector('#template-search')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      sessionStorage.setItem('template-search', e.target.value);
      sessionStorage.setItem('template-page', '1');
      renderTemplateTable(container);
    }, 300);
  }, { signal });

  // ── Pagination ──
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-template-page');
    if (!btn || btn.disabled) return;
    const page = parseInt(btn.getAttribute('data-page'));
    if (page < 1) return;
    sessionStorage.setItem('template-page', String(page));
    renderTemplateTable(container);
  }, { signal });

  // ── Open Create Modal ──
  container.querySelector('#btn-create-template')?.addEventListener('click', () => {
    container.querySelector('#template-edit-id').value = '';
    container.querySelector('#template-modal-title').textContent = t('templates.modalCreateTitle');
    container.querySelector('#field-name').value = '';
    container.querySelector('#field-category').value = '';
    container.querySelector('#field-content').value = '';
    document.querySelector('input[name="template-status"][value="draft"]').checked = true;
    container.querySelector('#template-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }, { signal });

  // ── Close Modal ──
  const closeModal = () => {
    container.querySelector('#template-modal').classList.add('hidden');
    document.body.style.overflow = '';
  };
  container.querySelector('#template-modal-close')?.addEventListener('click', closeModal, { signal });
  container.querySelector('#template-modal-cancel')?.addEventListener('click', closeModal, { signal });
  container.querySelector('#template-modal-backdrop')?.addEventListener('click', closeModal, { signal });

  // ── Save Template ──
  container.querySelector('#template-modal-save')?.addEventListener('click', async () => {
    const editId = container.querySelector('#template-edit-id').value;
    const name = container.querySelector('#field-name').value.trim();
    const category = container.querySelector('#field-category').value;
    const status = document.querySelector('input[name="template-status"]:checked')?.value || 'draft';
    const content = container.querySelector('#field-content').value.trim();

    if (!name) { alert(t('templates.nameRequired')); return; }
    if (!category) { alert(t('templates.categoryRequired')); return; }

    const templates = getTemplates();
    const currentUser = JSON.parse(localStorage.getItem('hrbp_current_user') || '{}');

    if (editId) {
      // Edit existing
      const idx = templates.findIndex(t => t.id === editId);
      if (idx !== -1) {
        const old = templates[idx];
        const parts = (old.version || 'V 0').replace('V ', '').split('.');
        const major = parseInt(parts[0]) || 0;
        const minor = parseInt(parts[1]) || 0;
        const newVersion = (name !== old.name || category !== old.category) ? `V ${major + 1}.0` : `V ${major}.${minor + 1}`;
        const updatedTmpl = {
          ...old,
          name,
          category,
          status,
          statusLabel: status === 'published' ? t('status.published') : status === 'disabled' ? t('status.disabled') : t('status.draft'),
          version: newVersion,
          content,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.full_name || currentUser.email || 'HR',
          updated_by: currentUser.full_name || currentUser.email || 'HR',
          icon: CATEGORY_ICONS[category] || 'description',
        };
        await updateTemplate(editId, updatedTmpl);
        addEdit(name);
        showToast(t('templates.saveToast'));
      }
    } else {
      // Create new
      const maxVersion = templates.filter(t => t.name.includes(name.substring(0, 8))).length + 1;
      const newTmpl = {
        id: nextId(),
        name,
        category,
        status,
        statusLabel: status === 'published' ? t('status.published') : status === 'disabled' ? t('status.disabled') : t('status.draft'),
        version: `V 1.${maxVersion - 1}`,
        content,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedBy: currentUser.full_name || currentUser.email || 'HR',
        updated_by: currentUser.full_name || currentUser.email || 'HR',
        icon: CATEGORY_ICONS[category] || 'description',
      };
      await createTemplate(newTmpl);
      addEdit(name);
      showToast(t('templates.createToast'));
    }

    closeModal();
    renderTemplateTable(container);
  }, { signal });

  // ── Edit button (delegated) ──
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-template-edit');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const templates = getTemplates();
    const tmpl = templates.find(t => t.id === id);
    if (!tmpl) return;

    container.querySelector('#template-edit-id').value = tmpl.id;
    container.querySelector('#template-modal-title').textContent = t('templates.modalEditTitle');
    container.querySelector('#field-name').value = tmpl.name;
    container.querySelector('#field-category').value = tmpl.category;
    container.querySelector('#field-content').value = tmpl.content || '';
    const radio = container.querySelector(`input[name="template-status"][value="${tmpl.status}"]`);
    if (radio) radio.checked = true;
    container.querySelector('#template-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }, { signal });

  // ── Toggle disable/enable ──
  container.addEventListener('click', async (e) => {
    const disableBtn = e.target.closest('.btn-template-disable');
    const enableBtn = e.target.closest('.btn-template-enable');
    const id = disableBtn?.getAttribute('data-id') || enableBtn?.getAttribute('data-id');
    if (!id) return;

    const templates = getTemplates();
    const idx = templates.findIndex(t => t.id === id);
    if (idx === -1) return;

    const isDisabling = !!disableBtn;
    const current = { ...templates[idx] };
    if (isDisabling) {
      current.status = 'disabled';
      current.statusLabel = t('status.disabled');
      addEdit(t('common.disable') + ': ' + current.name);
      showToast(t('templates.disableToast'));
    } else {
      current.status = 'draft';
      current.statusLabel = t('status.draft');
      addEdit(t('common.enable') + ': ' + current.name);
      showToast(t('templates.enableToast'));
    }
    current.updatedAt = new Date().toISOString();
    const currentUser = JSON.parse(localStorage.getItem('hrbp_current_user') || '{}');
    current.updatedBy = currentUser.full_name || currentUser.email || 'HR';
    
    await updateTemplate(id, current);
    renderTemplateTable(container);
  }, { signal });

  // ── Preview button (delegated) ──
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-template-preview');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const id = btn.getAttribute('data-id');
    const templates = getTemplates();
    const tmpl = templates.find(t => t.id === id);
    if (!tmpl) return;
    const content = tmpl.content || '';
    if (!content.trim()) {
      showToast('ยังไม่มี HTML Content ในเทมเพลตนี้', 'info');
      return;
    }

    const preview = buildTemplatePreviewHtml(content, tmpl);
    if (!openTemplatePreviewWindow(preview)) {
      showToast('ไม่สามารถเปิดหน้าต่างได้ กรุณาอนุญาต Popup ในเบราว์เซอร์', 'error');
    }
  }, { signal });

  return () => ac.abort();
}
