/**
 * Employee: New Request Form
 * Updated: Added Document Type, Conditional Fields, Delivery Method, Preview Modal, FAQ
 */
import { getCurrentUser } from '../mock-data.js';
import { navigate } from '../router.js';
import { getUsers, getHrmsEmployee, uploadFile, getPickupLocations, createRequest, getTemplates } from '../lib/api.js';
import { loadAvatarForElement } from '../lib/avatar-helper.js';
import { t } from '../lib/i18n.js';

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia',
  'Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium',
  'Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei',
  'Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Central African Republic',
  'Chad','Chile','China','Colombia','Comoros','Congo (Brazzaville)','Congo (Kinshasa)','Costa Rica',
  'Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic',
  'East Timor','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini',
  'Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece',
  'Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland',
  'India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Ivory Coast','Jamaica','Japan',
  'Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon',
  'Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia',
  'Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia',
  'Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru',
  'Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia',
  'Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru',
  'Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis',
  'Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe',
  'Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia',
  'Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan',
  'Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Togo',
  'Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine',
  'United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu',
  'Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
];

function buildCountryDropdownHTML(id, placeholder) {
  return `
    <div class="country-dropdown relative" data-input-id="${id}">
      <input type="hidden" id="${id}" class="country-hidden-input" />
      <input type="text" class="country-search-input w-full bg-white border border-outline-variant rounded-lg px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-on-surface font-medium" placeholder="${placeholder}" autocomplete="off" />
      <div class="country-dropdown-list absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-outline-variant rounded-lg shadow-lg hidden"></div>
    </div>`;
}

function bindCountryDropdown(containerEl, id) {
  const wrapper = containerEl.querySelector(`.country-dropdown[data-input-id="${id}"]`);
  if (!wrapper) return;
  const hidden = wrapper.querySelector('.country-hidden-input');
  const search = wrapper.querySelector('.country-search-input');
  const listEl = wrapper.querySelector('.country-dropdown-list');
  let activeIdx = -1;

  function renderList(query) {
    const q = (query || '').toLowerCase();
    const matches = q ? COUNTRIES.filter(c => c.toLowerCase().includes(q)) : COUNTRIES;
    listEl.innerHTML = matches.length
      ? matches.map(c => `<div class="country-option px-4 py-2.5 cursor-pointer hover:bg-primary/8 text-body-md text-on-surface transition-colors" data-value="${c}">${c}</div>`).join('')
      : `<div class="px-4 py-3 text-body-md text-outline italic">No results</div>`;
    activeIdx = -1;
  }

  search.addEventListener('focus', () => { renderList(search.value); listEl.classList.remove('hidden'); });
  search.addEventListener('input', () => { renderList(search.value); listEl.classList.remove('hidden'); });

  listEl.addEventListener('click', (e) => {
    const opt = e.target.closest('.country-option');
    if (!opt) return;
    const val = opt.getAttribute('data-value');
    hidden.value = val;
    search.value = val;
    listEl.classList.add('hidden');
  });

  search.addEventListener('keydown', (e) => {
    const opts = listEl.querySelectorAll('.country-option');
    if (!opts.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, opts.length - 1); opts.forEach((o, i) => o.classList.toggle('bg-primary/8', i === activeIdx)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); opts.forEach((o, i) => o.classList.toggle('bg-primary/8', i === activeIdx)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIdx >= 0 && opts[activeIdx]) { opts[activeIdx].click(); } }
    else if (e.key === 'Escape') { listEl.classList.add('hidden'); }
  });

  search.addEventListener('blur', () => { setTimeout(() => listEl.classList.add('hidden'), 150); });
}

/**
 * Format ISO date string (e.g. "2024-01-15") to Thai readable ("15 มกราคม 2567")
 */
function formatStartDate(raw) {
  if (!raw || raw === '-') return '-';
  const isoMatch = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const months = t('month.long');
    const year  = parseInt(isoMatch[1]) + 543;
    const month = parseInt(isoMatch[2]) - 1;
    const day   = parseInt(isoMatch[3]);
    return `${day} ${months[month]} ${year}`;
  }
  return raw;
}

/** คำนวณ ETA (วันทำการ) */
function addWorkingDays(date, days) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

function formatThaiDate(date) {
  const months = t('month.short');
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}

export function renderNewRequest() {
  const user = getCurrentUser();

  // ── Detect on-behalf-of mode ───────────────────────────────────
  const onBehalfEmpId = new URLSearchParams(window.location.hash.split('?')[1] || '').get('on_behalf_of') || '';
  const isOnBehalf = !!onBehalfEmpId;

  const empCode    = user?.emp_id       || user?.empCode    || '';
  const fullName   = user?.full_name    || user?.nameDisplay || user?.name || '';
  const position   = user?.position     || '';
  const department = user?.department   || '';
  const companyName= user?.company_name || user?.companyName || '-';
  const startDate  = formatStartDate(user?.start_date || user?.startDate || '-');

  const etaDate    = addWorkingDays(new Date(), 3);
  const etaDisplay = formatThaiDate(etaDate);


  // ── Purpose Options ────────────────────────────────────────────
  const purposes = [
    { value: 'bank',    icon: 'account_balance', label: t('newReq.purposeBank'), checked: true },
    { value: 'visa',    icon: 'flight_takeoff',  label: t('newReq.purposeVisa'), checked: false },
    { value: 'abroad',  icon: 'public',          label: t('newReq.purposeAbroad'), checked: false },
    { value: 'study',   icon: 'school',          label: t('newReq.purposeStudy'), checked: false },
    { value: 'other',   icon: 'more_horiz',      label: t('newReq.purposeOther'), checked: false },
  ];

  // ── FAQ Data ───────────────────────────────────────────────────
  const faqs = [
    { q: 'ต้องรอนานแค่ไหน?',          a: 'โดยทั่วไปใช้เวลา 3 วันทำการ HR อาจปรับกำหนดได้ตามความซับซ้อนของเคส' },
    { q: 'ขอได้กี่ฉบับต่อครั้ง?',       a: 'สามารถขอได้ครั้งละ 1 ฉบับต่อประเภท หากต้องการหลายฉบับกรุณาส่งคำขอแยกกัน' },
    { q: 'หากต้องการเอกสารทั้งภาษาไทยและภาษาอังกฤษ?', a: 'เนื่องจากระบบใช้เทมเพลตมาตรฐานตามที่กำหนดไว้ หากต้องการทั้ง 2 ภาษา กรุณาส่งคำขอแยกกันเป็น 2 รายการ' },
    { q: 'เอกสารมีอายุการใช้งานนานแค่ไหน?', a: 'โดยทั่วไป 3–6 เดือน ขึ้นอยู่กับข้อกำหนดของแต่ละสถาบัน' },
    { q: 'ข้อมูลในฟอร์มไม่ถูกต้อง ทำอย่างไร?', a: 'กรุณาติดต่อ HR เพื่อแก้ไขข้อมูลในระบบก่อน จากนั้นจึงส่งคำขอ' },
  ];

  return `
    <!-- Breadcrumbs & Header -->
    <div class="mb-10">
      <nav class="flex text-label-sm font-medium text-on-surface-variant gap-2 mb-6">
        <span class="hover:text-primary cursor-pointer transition-colors" data-navigate="/employee/requests">${t('newReq.breadcrumb')}</span>
        <span class="opacity-40">/</span>
        <span class="text-primary font-bold">${t('newReq.breadcrumbActive')}</span>
      </nav>
      <h1 class="page-title">${isOnBehalf ? 'สร้างคำขอแทนพนักงาน' : t('newReq.pageTitle')}</h1>
      <p class="page-subtitle max-w-2xl">
        ${t('newReq.pageDesc', { eta: etaDisplay })}
      </p>
    </div>

    ${isOnBehalf ? `
    <!-- On-Behalf Banner -->
    <div class="mb-6 bg-amber-50 border-2 border-amber-300 rounded-xl px-6 py-4 flex items-center gap-4">
      <span class="material-symbols-outlined text-amber-600 text-[28px] shrink-0">supervised_user_circle</span>
      <div>
        <p class="text-label-md font-bold text-amber-900">โหมด: HR สร้างคำขอแทนพนักงาน</p>
        <p class="text-label-sm text-amber-700 mt-0.5">ระบุรหัสพนักงานด้านล่าง ข้อมูลจะดึงมาแสดงอัตโนมัติ</p>
      </div>
      <div id="on-behalf-name-badge" class="ml-auto px-4 py-2 bg-amber-200 rounded-lg text-amber-900 font-bold text-label-sm hidden">
        <!-- filled dynamically -->
      </div>
    </div>
    ` : ''}

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
      <!-- Left Column: Form -->
      <div class="lg:col-span-3 space-y-8">

        <!-- ===== Step 1: Employee Information ===== -->
        <section class="bg-white p-6 md:p-8 rounded-xl card-shadow border border-outline-variant/40">
          <div class="flex items-center gap-4 mb-8">
            <span class="h-9 w-9 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-lg">1</span>
            <h3 class="text-headline-md text-primary tracking-tight">${t('newReq.sectionEmployee')} <span class="text-label-sm font-normal text-outline ml-2">${isOnBehalf ? 'ระบุรหัสพนักงาน → ดึงข้อมูลอัตโนมัติ' : t('newReq.sectionAuto')}</span></h3>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <label class="block text-label-md font-semibold text-on-surface-variant mb-2.5">${t('nav.employeeId')} ${isOnBehalf ? '<span class="text-error">*</span>' : ''}</label>
              ${isOnBehalf ? `
              <div class="flex gap-2">
                <input id="on-behalf-emp-id-field" class="flex-1 bg-white border border-primary rounded-lg px-4 py-3 text-on-surface font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all" type="text" value="${onBehalfEmpId}" placeholder="รหัสพนักงาน" />
                <button id="btn-fetch-emp" class="px-3 py-2 bg-primary text-on-primary rounded-lg font-bold hover:opacity-90 transition-opacity flex items-center gap-1" title="ค้นหาข้อมูล">
                  <span class="material-symbols-outlined text-[20px]">person_search</span>
                </button>
              </div>
              <p id="on-behalf-fetch-status" class="text-label-xs mt-1 text-on-surface-variant hidden"></p>
              ` : `
              <input class="w-full bg-surface-container-low border border-outline-variant/60 rounded-lg px-4 py-3 text-on-surface font-medium cursor-not-allowed" readonly type="text" value="${empCode}" placeholder="-" />
              `}
            </div>
            <div>
              <label class="block text-label-md font-semibold text-on-surface-variant mb-2.5">${t('newReq.labelTableName')}</label>
              <input id="field-full-name" class="w-full bg-surface-container-low border border-outline-variant/60 rounded-lg px-4 py-3 text-on-surface font-medium cursor-not-allowed" readonly type="text" value="${isOnBehalf ? '' : fullName}" placeholder="-" />
            </div>
            <div>
              <label class="block text-label-md font-semibold text-on-surface-variant mb-2.5">${t('common.position')}</label>
              <input id="field-position" class="w-full bg-surface-container-low border border-outline-variant/60 rounded-lg px-4 py-3 text-on-surface font-medium cursor-not-allowed" readonly type="text" value="${isOnBehalf ? '' : position}" placeholder="-" />
            </div>
            <div>
              <label class="block text-label-md font-semibold text-on-surface-variant mb-2.5">${t('nav.department')}</label>
              <input id="field-department" class="w-full bg-surface-container-low border border-outline-variant/60 rounded-lg px-4 py-3 text-on-surface font-medium cursor-not-allowed" readonly type="text" value="${isOnBehalf ? '' : department}" placeholder="-" />
            </div>
            <div>
              <label class="block text-label-md font-semibold text-on-surface-variant mb-2.5">${t('nav.company')}</label>
              <input id="field-company" class="w-full bg-surface-container-low border border-outline-variant/60 rounded-lg px-4 py-3 text-on-surface font-medium cursor-not-allowed" readonly type="text" value="${isOnBehalf ? '' : companyName}" placeholder="-" />
            </div>
            <div>
              <label class="block text-label-md font-semibold text-on-surface-variant mb-2.5">${t('common.startDate')}</label>
              <input id="field-start-date" class="w-full bg-surface-container-low border border-outline-variant/60 rounded-lg px-4 py-3 text-on-surface font-medium cursor-not-allowed" readonly type="text" value="${isOnBehalf ? '' : startDate}" placeholder="-" />
            </div>
          </div>

          <!-- HR Officers -->
          <div class="mt-8 pt-6 border-t border-outline-variant/40">
            <label class="block text-label-md font-semibold text-on-surface-variant mb-4">${t('newReq.labelSelectHr')}</label>
            <div class="overflow-x-auto rounded-xl border border-outline-variant/40">
              <table class="w-full text-left">
                <thead class="bg-surface-container-low border-b border-outline-variant/40 text-label-sm text-on-surface-variant font-bold">
                  <tr>
                    <th class="p-4 w-12 text-center">${t('newReq.labelTableSelect')}</th>
                    <th class="p-4">${t('newReq.labelTableName')}</th>
                    <th class="p-4">${t('newReq.labelTableBu')}</th>
                    <th class="p-4 text-center">${t('newReq.labelTablePhone')}</th>
                  </tr>
                </thead>
                <tbody id="hr-officers-tbody">
                  <tr>
                    <td colspan="4" class="p-8 text-center text-on-surface-variant font-medium">
                      <div class="flex items-center justify-center gap-2">
                        <span class="material-symbols-outlined animate-spin text-[20px] text-primary">sync</span>
                        <span>${t('newReq.loadingHr')}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- ===== Step 2: Document Type & Purpose ===== -->
        <section class="bg-white p-6 md:p-8 rounded-xl card-shadow border border-outline-variant/40">
          <div class="flex items-center gap-4 mb-8">
            <span class="h-9 w-9 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-lg">2</span>
            <h3 class="text-headline-md text-primary tracking-tight">${t('newReq.sectionDocType')}</h3>
          </div>
          <div class="space-y-8">

            <!-- เทมเพลตจากฐานข้อมูล (เมนูจัดการเทมเพลต) -->
            <div>
              <label class="block text-label-md font-semibold text-on-surface-variant mb-4">${t('newReq.labelDocType')} <span class="text-error">*</span></label>
              <div id="template-selector-container" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                ${[1,2].map(() => `
                  <div class="animate-pulse border-2 border-outline-variant/30 rounded-xl p-5 flex flex-col gap-3 h-28">
                    <div class="w-7 h-7 bg-surface-container-high rounded-lg"></div>
                    <div class="h-3.5 bg-surface-container-high rounded w-3/4 mt-1"></div>
                    <div class="h-2.5 bg-surface-container-high rounded w-full"></div>
                    <div class="h-2.5 bg-surface-container-high rounded w-2/3"></div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Purpose (วัตถุประสงค์) -->
            <div>
              <label class="block text-label-md font-semibold text-on-surface-variant mb-4">${t('newReq.labelPurpose')} <span class="text-error">*</span></label>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                ${purposes.map(item => `
                  <label class="radio-card cursor-pointer">
                    <input ${item.checked ? 'checked' : ''} class="peer sr-only purpose-radio" name="purpose" type="radio" value="${item.value}" />
                    <div class="radio-content flex flex-col items-center justify-center p-5 border border-outline-variant rounded-xl transition-all peer-checked:border-primary peer-checked:bg-primary-fixed/30 peer-checked:text-primary hover:bg-surface-container-low">
                      <span class="material-symbols-outlined block mb-2 text-2xl">${item.icon}</span>
                      <span class="text-label-sm font-bold">${item.label}</span>
                    </div>
                  </label>
                `).join('')}
              </div>
            </div>

            <!-- ✅ TO-BE: Conditional Fields -->
            <!-- Visa fields (แสดงเมื่อเลือก "ขอวีซ่า") -->
            <div id="conditional-visa" class="hidden bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-4 animate-fade-in">
              <p class="text-label-md font-bold text-primary flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">flight_takeoff</span>
                ${t('newReq.sectionVisa')}
              </p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-label-md font-semibold text-on-surface-variant mb-2">${t('newReq.labelVisaCountry')}</label>
                  ${buildCountryDropdownHTML('visa-country', t('newReq.visaPlaceholder'))}
                </div>
                <div>
                  <label class="block text-label-md font-semibold text-on-surface-variant mb-2">${t('newReq.labelTravelDate')}</label>
                  <input id="visa-travel-date" type="date" class="w-full bg-white border border-outline-variant rounded-lg px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-on-surface font-medium" />
                </div>
              </div>
            </div>

            <!-- Abroad work conditional -->
            <div id="conditional-abroad" class="hidden bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-4 animate-fade-in">
              <p class="text-label-md font-bold text-primary flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">public</span>
                ${t('newReq.sectionAbroad')}
              </p>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="md:col-span-1">
                  <label class="block text-label-md font-semibold text-on-surface-variant mb-2">${t('newReq.labelAbroadDestination')} <span class="text-error">*</span></label>
                  ${buildCountryDropdownHTML('abroad-destination', t('newReq.abroadDestinationPlaceholder'))}
                </div>
                <div>
                  <label class="block text-label-md font-semibold text-on-surface-variant mb-2">${t('newReq.labelAbroadStartDate')} <span class="text-error">*</span></label>
                  <input id="abroad-start-date" type="date" class="w-full bg-white border border-outline-variant rounded-lg px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-on-surface font-medium" />
                </div>
                <div>
                  <label class="block text-label-md font-semibold text-on-surface-variant mb-2">${t('newReq.labelAbroadEndDate')} <span class="text-error">*</span></label>
                  <input id="abroad-end-date" type="date" class="w-full bg-white border border-outline-variant rounded-lg px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-on-surface font-medium" />
                </div>
              </div>
            </div>

            <!-- Bank/Study conditional (แสดงเมื่อเลือก "ยื่นกู้" หรือ "ศึกษาต่อ") -->
            <div id="conditional-institution" class="hidden bg-surface-container-lowest border border-outline-variant rounded-xl p-5 animate-fade-in">
              <p class="text-label-md font-bold text-primary flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-[18px]">account_balance</span>
                ${t('newReq.sectionInstitution')}
              </p>
              <div>
                <label class="block text-label-md font-semibold text-on-surface-variant mb-2" id="institution-label">${t('newReq.labelInstitution')}</label>
                <input id="institution-name" type="text" placeholder="${t('newReq.institutionPlaceholder')}" class="w-full bg-white border border-outline-variant rounded-lg px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-on-surface font-medium" />
              </div>
            </div>

            <!-- Other conditional -->
            <div id="conditional-other" class="hidden bg-surface-container-lowest border border-outline-variant rounded-xl p-5 animate-fade-in">
              <div>
                <label class="block text-label-md font-semibold text-on-surface-variant mb-2">${t('newReq.labelOtherPurpose')}</label>
                <input id="other-purpose" type="text" placeholder="${t('newReq.otherPlaceholder')}" class="w-full bg-white border border-outline-variant rounded-lg px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-on-surface font-medium" />
              </div>
            </div>

            <!-- Salary Info only (Language is determined by selected template) -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
              <div>
                <label class="block text-label-md font-semibold text-on-surface-variant mb-2.5">${t('newReq.labelSalary')}</label>
                <div class="flex items-center gap-6 py-3">
                  <label class="flex items-center gap-2.5 cursor-pointer">
                    <input class="w-5 h-5 text-primary border-outline-variant focus:ring-primary/20 transition-all" name="salary" type="radio" value="yes" id="salary-yes" />
                    <span class="text-body-md font-medium text-on-surface">${t('common.yes')}</span>
                  </label>
                  <label class="flex items-center gap-2.5 cursor-pointer">
                    <input checked class="w-5 h-5 text-primary border-outline-variant focus:ring-primary/20 transition-all" name="salary" type="radio" value="no" id="salary-no" />
                    <span class="text-body-md font-medium text-on-surface">${t('common.no')}</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Notes -->
            <div class="pt-2">
              <label class="block text-label-md font-semibold text-on-surface-variant mb-2.5">${t('newReq.labelNotes')}</label>
              <textarea id="notes-textarea" class="w-full bg-white border border-outline-variant rounded-lg px-4 py-3.5 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none resize-none text-on-surface font-medium" placeholder="${t('newReq.notesPlaceholder')}" rows="4"></textarea>
            </div>
          </div>
        </section>

        <!-- ===== Step 3: Delivery Method ===== -->
        <section id="delivery-section" class="bg-white p-6 md:p-8 rounded-xl card-shadow border border-outline-variant/40">
          <div class="flex items-center gap-4 mb-8">
            <span class="h-9 w-9 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-lg">3</span>
            <h3 class="text-headline-md text-primary tracking-tight">${t('newReq.sectionDelivery')}</h3>
          </div>
          <div class="space-y-4">
            <!-- Digital E-Certificate (recommend) -->
            <label class="cursor-pointer block">
              <input type="checkbox" name="delivery" value="digital" id="delivery-digital" class="peer sr-only" />
              <div class="flex items-start gap-4 p-5 border-2 border-outline-variant rounded-xl peer-checked:border-primary peer-checked:bg-primary-fixed/20 hover:border-primary/50 transition-all">
                <div class="w-10 h-10 rounded-full bg-surface-container-high peer-checked:bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <span class="material-symbols-outlined text-on-surface-variant peer-checked:text-on-primary text-[20px]">picture_as_pdf</span>
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <p class="text-label-md font-bold text-on-surface peer-checked:text-primary">${t('newReq.deliveryDigital')}</p>
                    <span class="px-2 py-0.5 bg-primary text-on-primary text-[10px] font-bold rounded-full">${t('common.recommend')}</span>
                  </div>
                  <p class="text-label-sm text-on-surface-variant mt-1">${t('newReq.digitalDesc')}</p>
                </div>
              </div>
            </label>

            <!-- Physical Document -->
            <label class="cursor-pointer block">
              <input type="checkbox" name="delivery" value="physical" id="delivery-physical" class="peer sr-only" />
              <div class="flex items-start gap-4 p-5 border-2 border-outline-variant rounded-xl peer-checked:border-primary peer-checked:bg-primary-fixed/10 hover:border-primary/50 transition-all">
                <div class="w-10 h-10 rounded-full bg-surface-container-high peer-checked:bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <span class="material-symbols-outlined text-on-surface-variant peer-checked:text-on-primary text-[20px]">description</span>
                </div>
                <div class="flex-1">
                  <p class="text-label-md font-bold text-on-surface peer-checked:text-primary">${t('newReq.deliveryPhysical')}</p>
                  <p class="text-label-sm text-on-surface-variant mt-1">${t('newReq.physicalDesc')}</p>
                </div>
              </div>
            </label>

            <!-- ✅ TO-BE: Physical Location picker (Conditional) -->
            <div id="physical-location-picker" class="hidden pl-4 animate-fade-in">
              <label class="block text-label-md font-semibold text-on-surface-variant mb-3">${t('newReq.labelPickup')}</label>
              <div id="pickup-locations-container" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="col-span-2 text-center text-on-surface-variant py-4">
                  <span class="material-symbols-outlined animate-spin text-[20px] text-primary align-middle">sync</span>
                  <span class="text-label-sm ml-2">${t('common.loading')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== Step 4: Supporting Documents ===== -->
        <section class="bg-white p-6 md:p-8 rounded-xl card-shadow border border-outline-variant/40">
          <div class="flex items-center gap-4 mb-8">
            <span class="h-9 w-9 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-lg">4</span>
            <h3 class="text-headline-md text-primary tracking-tight">${t('newReq.sectionAttachments')}</h3>
          </div>
          <div class="space-y-6">
            <div>
              <label class="block text-label-md font-semibold text-on-surface-variant mb-2.5">${t('newReq.fileUploadLabel')}</label>
              <div id="file-dropzone" class="relative border-2 border-dashed border-outline-variant rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-all bg-surface-container-lowest">
                <input id="file-input" type="file" multiple class="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
                <span class="material-symbols-outlined text-4xl text-outline-variant mb-3">cloud_upload</span>
                <p class="text-body-md font-medium text-on-surface-variant mb-1">${t('newReq.dropzoneText')}</p>
                <p class="text-label-sm text-outline-variant">${t('newReq.fileRestrict')}</p>
              </div>
              <ul id="file-list" class="mt-4 space-y-2"></ul>
            </div>
          </div>
        </section>

        <!-- Action Buttons -->
        <div class="flex flex-col md:flex-row gap-5 pb-12">
          <button id="btn-preview-request" class="flex-[2] bg-primary text-on-primary py-4 rounded-xl font-bold text-headline-md hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 h-16 flex items-center justify-center gap-2">
            <span class="material-symbols-outlined">preview</span>
            ${t('newReq.previewBtn')}
          </button>
          <button id="btn-cancel-request" class="flex-1 bg-error-container text-on-error-container py-4 rounded-xl font-bold text-headline-md hover:bg-error/20 active:scale-[0.98] transition-all h-16">
            ${t('newReq.cancelBtn')}
          </button>
        </div>
      </div>

      <!-- ===== Right Column: Info Cards ===== -->
      <div class="space-y-6">
        <!-- Card: Delivery Info -->
        <div class="bg-white rounded-xl card-shadow border border-outline-variant/40 p-6 flex flex-col transition-transform hover:-translate-y-1 duration-300">
          <h4 class="text-label-md font-bold text-primary flex items-center gap-2 mb-4">
            <span class="material-symbols-outlined text-[20px]">schedule</span>
            ${t('newReq.infoTimeline')}
          </h4>
          <div class="space-y-3">
            <div class="flex items-center gap-3 text-label-sm">
              <span class="material-symbols-outlined text-primary text-[18px]">picture_as_pdf</span>
              <span class="text-on-surface-variant flex-1">${t('newReq.digitalRow')}</span>
              <span class="font-bold text-primary">${t('newReq.digitalDuration')}</span>
            </div>
            <div class="flex items-center gap-3 text-label-sm">
              <span class="material-symbols-outlined text-outline text-[18px]">description</span>
              <span class="text-on-surface-variant flex-1">${t('newReq.physicalRow')}</span>
              <span class="font-bold text-on-surface">${t('newReq.physicalDuration')}</span>
            </div>
          </div>
          <p class="text-[10px] text-outline mt-3">${t('newReq.timelineNote')}</p>
        </div>

        <!-- Card: Important Info -->
        <div class="bg-white rounded-xl card-shadow border border-outline-variant/40 p-6 flex flex-col transition-transform hover:-translate-y-1 duration-300">
          <h4 class="text-label-md font-bold text-primary mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-[20px]">info</span>
            ${t('newReq.infoImportant')}
          </h4>
          <div class="flex gap-4 items-start p-1">
            <span class="material-symbols-outlined text-on-tertiary-container text-[24px]">history</span>
            <span class="text-label-md font-medium text-on-surface-variant leading-relaxed">${t('newReq.importantText')}</span>
          </div>
        </div>

        <!-- ✅ TO-BE: FAQ Section -->
        <div class="bg-white rounded-xl card-shadow border border-outline-variant/40 p-6">
          <h4 class="text-label-md font-bold text-primary flex items-center gap-2 mb-4">
            <span class="material-symbols-outlined text-[20px]">help</span>
            ${t('newReq.faqTitle')}
          </h4>
          <div class="space-y-2" id="faq-list">
            ${faqs.map((faq, i) => `
              <div class="border border-outline-variant/40 rounded-xl overflow-hidden">
                <button class="faq-toggle w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-container-low transition-colors" data-faq="${i}">
                  <span class="text-label-sm font-bold text-on-surface pr-3">${faq.q}</span>
                  <span class="material-symbols-outlined text-outline shrink-0 faq-icon transition-transform">expand_more</span>
                </button>
                <div class="faq-answer hidden px-4 pb-3">
                  <p class="text-label-sm text-on-surface-variant leading-relaxed">${faq.a}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Preview & Confirm Modal ===== -->
    <div id="preview-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 hidden">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" id="preview-modal-backdrop"></div>
      <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
        <div class="h-1.5 bg-primary w-full shrink-0"></div>
        <div class="flex items-center justify-between px-6 pt-5 pb-3 shrink-0 border-b border-outline-variant">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-primary">preview</span>
            <h3 class="text-title-md font-bold text-on-surface">${t('newReq.previewModalTitle')}</h3>
          </div>
          <button id="preview-modal-close" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-outline transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div class="px-6 py-5 overflow-y-auto flex-1">
          <!-- Preview Content -->
          <div class="bg-surface-container rounded-xl p-5 mb-5 border border-outline-variant/40">
            <p class="text-label-xs font-bold text-outline uppercase tracking-widest mb-3">${t('newReq.previewSectionEmployee')}</p>
            ${isOnBehalf ? `<div class="mb-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-label-xs text-amber-700 font-semibold">⚠️ สร้างคำขอแทนพนักงาน</div>` : ''}
            <div class="grid grid-cols-2 gap-y-2 text-label-sm">
              <span class="text-on-surface-variant">${t('nav.employeeId')}</span><span id="preview-emp-code" class="font-bold text-on-surface">${isOnBehalf ? '' : empCode}</span>
              <span class="text-on-surface-variant">${t('newReq.labelTableName')}</span><span id="preview-full-name" class="font-bold text-on-surface">${isOnBehalf ? '' : fullName}</span>
              <span class="text-on-surface-variant">${t('common.position')}</span><span id="preview-position" class="font-bold text-on-surface">${isOnBehalf ? '' : position}</span>
              <span class="text-on-surface-variant">${t('nav.department')}</span><span id="preview-department" class="font-bold text-on-surface">${isOnBehalf ? '' : department}</span>
              <span class="text-on-surface-variant">${t('nav.company')}</span><span id="preview-company" class="font-bold text-on-surface">${isOnBehalf ? '' : companyName}</span>
            </div>
          </div>
          <div class="bg-surface-container rounded-xl p-5 mb-5 border border-outline-variant/40">
            <p class="text-label-xs font-bold text-outline uppercase tracking-widest mb-3">${t('newReq.previewSectionDetail')}</p>
            <div class="grid grid-cols-2 gap-y-2 text-label-sm">
              <span class="text-on-surface-variant">${t('common.type')}</span><span id="preview-doc-type" class="font-bold text-on-surface">-</span>
              <span class="text-on-surface-variant">${t('newReq.labelPurpose')}</span><span id="preview-purpose" class="font-bold text-on-surface">-</span>
              <span class="text-on-surface-variant">${t('newReq.labelLanguage')}</span><span id="preview-language" class="font-bold text-on-surface">-</span>
              <span class="text-on-surface-variant">${t('newReq.labelSalary')}</span><span id="preview-salary" class="font-bold text-on-surface">-</span>
              <span class="text-on-surface-variant">${t('newReq.previewPurposeExtra')}</span><span id="preview-purpose-extra" class="font-bold text-on-surface">-</span>
              <span class="text-on-surface-variant">${t('newReq.previewNotes')}</span><span id="preview-notes" class="font-bold text-on-surface">-</span>
            </div>
          </div>
          <div class="bg-surface-container rounded-xl p-5 mb-5 border border-outline-variant/40">
            <p class="text-label-xs font-bold text-outline uppercase tracking-widest mb-3">${t('newReq.previewSectionDelivery')}</p>
            <div class="grid grid-cols-2 gap-y-2 text-label-sm">
              <span class="text-on-surface-variant">${t('common.type')}</span><span id="preview-delivery" class="font-bold text-on-surface">-</span>
              <span class="text-on-surface-variant">${t('employeeReq.etaLabel')}</span>
              <span class="font-bold text-primary">${etaDisplay}</span>
              <span id="preview-pickup-row" class="hidden text-on-surface-variant">${t('newReq.previewPickupLocation')}</span>
              <span id="preview-pickup-location" class="hidden font-bold text-on-surface">-</span>
            </div>
          </div>
          <p class="text-label-xs text-outline text-center">${t('newReq.previewFooter')}</p>
        </div>
        <div class="px-6 py-4 border-t border-outline-variant flex gap-3 shrink-0">
          <button id="preview-edit-btn" class="flex-1 py-3 border border-outline-variant text-on-surface-variant font-bold rounded-xl hover:bg-surface-container transition-colors">
            ${t('newReq.previewEditBtn')}
          </button>
          <button id="btn-submit-request" class="flex-[2] py-3 bg-primary text-on-primary font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            <span class="material-symbols-outlined">send</span>
            ${t('newReq.previewSubmitBtn')}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div id="toast-notification" class="fixed inset-0 z-[200] flex items-center justify-center hidden">
      <div class="absolute inset-0 bg-black/30"></div>
      <div class="relative flex flex-col items-center gap-3 bg-surface-container-high border border-outline-variant px-8 py-6 rounded-2xl shadow-2xl text-label-md font-bold min-w-[300px] max-w-sm animate-[fadeIn_0.2s_ease-out]">
        <span id="toast-icon" class="material-symbols-outlined text-[36px] text-primary">check_circle</span>
        <span id="toast-message" class="text-on-surface text-center">${t('common.success')}</span>
      </div>
    </div>
  `;
}

export async function initNewRequest(container) {
  const uploadedFiles = [];

  // ── Detect on-behalf-of mode ───────────────────────────────────
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const onBehalfEmpId = params.get('on_behalf_of') || '';
  const isOnBehalf = !!onBehalfEmpId;
  const resubmitId = params.get('resubmit') || '';
  let targetEmployee = null; // resolved employee when in on-behalf mode

  // ── Resubmit: load original requester data so the new request keeps
  //    the employee's identity (not the session user / HR who clicks resubmit) ──
  if (resubmitId) {
    try {
      const all = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
      const orig = all.find(r => (r.id || r.request_code) === resubmitId);
      if (orig) {
        // Fallback to mock_users by user_email if the stored request lacks identity fields
        let fallback = {};
        try {
          const users = JSON.parse(localStorage.getItem('hrbp_mock_users') || '[]');
          const email = (orig.user_email || '').toLowerCase();
          fallback = users.find(u => (email && (u.email || '').toLowerCase() === email)
            || (orig.emp_id && String(u.emp_id) === String(orig.emp_id))) || {};
        } catch (_) {}
        targetEmployee = {
          emp_id: orig.emp_id || orig.empCode || fallback.emp_id || '',
          full_name: orig.full_name || orig.employee_name || fallback.full_name || '',
          position: orig.position || fallback.position || '',
          department: orig.department || fallback.department || '',
          company_name: orig.company_name || orig.companyName || fallback.company_name || '',
          email: orig.user_email || fallback.email || '',
          phone: orig.phone || fallback.phone || '',
          start_date: orig.start_date || orig.startDate || fallback.start_date || '',
          sex_id: orig.sex_id || fallback.sex_id || '',
          fname_e: orig.fname_e || fallback.fname_e || '',
          lname_e: orig.lname_e || fallback.lname_e || '',
        };
        // Prefill the read-only employee fields
        fillEmployeeFields(targetEmployee);
      }
    } catch (_) {}
  }

  // ── Breadcrumb navigation ──────────────────────────────────────
  container.querySelector('[data-navigate="/employee/requests"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/employee/requests');
  });

  // ── On-Behalf: fill employee info fields ───────────────────────
  function fillEmployeeFields(emp) {
    targetEmployee = emp;
    const nameField = container.querySelector('#field-full-name');
    const posField  = container.querySelector('#field-position');
    const deptField = container.querySelector('#field-department');
    const compField = container.querySelector('#field-company');
    const dateField = container.querySelector('#field-start-date');
    const nameBadge = container.querySelector('#on-behalf-name-badge');
    if (nameField) nameField.value = emp.full_name || emp.name || '';
    if (posField)  posField.value  = emp.position || '';
    if (deptField) deptField.value = emp.department || '';
    if (compField) compField.value = emp.company_name || emp.companyName || '';
    if (dateField) dateField.value = formatStartDate(emp.start_date || emp.startDate || '-');
    if (nameBadge) {
      nameBadge.textContent = emp.full_name || emp.name || '';
      nameBadge.classList.remove('hidden');
    }
  }

  // ── On-Behalf: fetch employee by emp_id ────────────────────────
  async function fetchOnBehalfEmployee(empId) {
    const statusEl = container.querySelector('#on-behalf-fetch-status');
    const btn      = container.querySelector('#btn-fetch-emp');
    if (btn) btn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">sync</span>';
    if (statusEl) {
      statusEl.textContent = '\u0e01\u0e33\u0e25\u0e31\u0e07\u0e04\u0e49\u0e19\u0e2b\u0e32...';
      statusEl.classList.remove('hidden');
      statusEl.className = 'text-label-xs mt-1 text-on-surface-variant';
    }
    try {
      const res = await getHrmsEmployee(empId);
      const emp = res?.data?.employee;
      if (emp) {
        const mapped = {
          emp_id: emp.ID_Emp,
          full_name: emp.EmpName,
          position: emp.Position,
          department: emp.Department,
          company_name: emp.CompanyName,
          email: emp.EMail,
          phone: emp.Sim_Number,
          start_date: emp.StartDate,
          sex_id: emp.SexID,
          fname_e: emp.FNameE,
          lname_e: emp.LNameE
        };
        fillEmployeeFields(mapped);
        if (statusEl) {
          statusEl.textContent = `\u0e1e\u0e1a\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25: ${emp.EmpName}`;
          statusEl.className = 'text-label-xs mt-1 text-green-600';
        }
      } else {
        targetEmployee = null;
        if (statusEl) {
          statusEl.textContent = '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19\u0e17\u0e35\u0e48\u0e21\u0e35\u0e23\u0e2b\u0e31\u0e2a\u0e19\u0e35\u0e49';
          statusEl.className = 'text-label-xs mt-1 text-error';
        }
      }
    } catch (err) {
      console.error('[OnBehalf] Fetch error:', err);
      if (statusEl) {
        statusEl.textContent = '\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14\u0e43\u0e19\u0e01\u0e32\u0e23\u0e04\u0e49\u0e19\u0e2b\u0e32';
        statusEl.className = 'text-label-xs mt-1 text-error';
      }
    } finally {
      if (btn) btn.innerHTML = '<span class="material-symbols-outlined text-[20px]">person_search</span>';
    }
  }

  if (isOnBehalf) {
    const empIdField = container.querySelector('#on-behalf-emp-id-field');
    const fetchBtn   = container.querySelector('#btn-fetch-emp');
    fetchBtn?.addEventListener('click', () => {
      const val = empIdField?.value?.trim();
      if (val) fetchOnBehalfEmployee(val);
    });
    empIdField?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = empIdField?.value?.trim();
        if (val) fetchOnBehalfEmployee(val);
      }
    });
    fetchOnBehalfEmployee(onBehalfEmpId);
  }

  // ── Toast helper ──────────────────────────────────────────────
  const showToast = (msg, icon = 'check_circle') => {
    const t = container.querySelector('#toast-notification');
    if (!t) return;
    container.querySelector('#toast-message').textContent = msg;
    container.querySelector('#toast-icon').textContent = icon;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
  };

  // ── Conditional Fields: Purpose ────────────────────────────────
  const purposeRadios = container.querySelectorAll('.purpose-radio');
  const conditionalVisa        = container.querySelector('#conditional-visa');
  const conditionalAbroad      = container.querySelector('#conditional-abroad');
  const conditionalInstitution = container.querySelector('#conditional-institution');
  const conditionalOther       = container.querySelector('#conditional-other');
  const institutionLabel       = container.querySelector('#institution-label');
  const langSelect             = container.querySelector('#select-language');

  // ── Helper: ดึง doc_type จาก data-doc-type ของ template radio ที่เลือก ────────
  function getSelectedDocType() {
    const el = container.querySelector('.doc-type-radio:checked');
    return el?.dataset?.docType || el?.value || 'work';
  }

  function updateConditionalFields() {
    const selectedPurpose = container.querySelector('.purpose-radio:checked')?.value;
    const selectedDocType = getSelectedDocType();
    const showAbroad = selectedPurpose === 'abroad' || selectedDocType === 'abroad';
    conditionalVisa?.classList.toggle('hidden', selectedPurpose !== 'visa');
    conditionalAbroad?.classList.toggle('hidden', !showAbroad);
    conditionalInstitution?.classList.toggle('hidden', selectedPurpose !== 'bank' && selectedPurpose !== 'study');
    conditionalOther?.classList.toggle('hidden', selectedPurpose !== 'other');
    if (institutionLabel) {
      institutionLabel.textContent = selectedPurpose === 'study' ? t('newReq.institutionStudy') : t('newReq.labelInstitution');
    }
  }
  purposeRadios.forEach(r => r.addEventListener('change', updateConditionalFields));
  bindCountryDropdown(container, 'visa-country');
  bindCountryDropdown(container, 'abroad-destination');
  // Show institution by default (bank is checked)
  conditionalInstitution?.classList.remove('hidden');

  // ── Dynamic Default for Salary/Income Info based on Document Type ──
  const salaryYes = container.querySelector('#salary-yes');
  const salaryNo = container.querySelector('#salary-no');

  function updateSalaryDefault() {
    const selectedDocType = getSelectedDocType();
    if (selectedDocType === 'salary' || selectedDocType === 'abroad') {
      if (salaryYes) salaryYes.checked = true;
    } else {
      if (salaryNo) salaryNo.checked = true;
    }
  }

  function updateDocTypeDefaults() {
    const selectedDocType = getSelectedDocType();
    if (selectedDocType === 'abroad') {
      const abroadPurpose = container.querySelector('.purpose-radio[value="abroad"]');
      if (abroadPurpose) abroadPurpose.checked = true;
      if (langSelect) langSelect.value = 'en';
    }
    updateSalaryDefault();
    updateConditionalFields();
  }
  // Event listeners สำหรับ doc-type-radio จะ attach ใน loadTemplates() หลัง render


  // ── Conditional Fields: Delivery Method (checkbox toggle) ────────
  const deliveryCheckboxes = container.querySelectorAll('input[name="delivery"]');
  const physicalPicker        = container.querySelector('#physical-location-picker');
  const pickupContainer       = container.querySelector('#pickup-locations-container');

  deliveryCheckboxes.forEach(cb => cb.addEventListener('change', () => {
    // Check if physical is selected
    const isPhysical = container.querySelector('#delivery-physical')?.checked;
    physicalPicker?.classList.toggle('hidden', !isPhysical);
  }));

  // Load pickup locations from API
  let selectedPickupValue = '';
  const loadPickupLocations = async () => {
    try {
      const result = await getPickupLocations();
      const locations = result.data || [];
      if (pickupContainer) {
        if (locations.length === 0) {
          pickupContainer.innerHTML = '<div class="col-span-2 text-center text-on-surface-variant py-4 text-label-sm">' + t('newReq.noPickup') + '</div>';
          return;
        }
        pickupContainer.innerHTML = locations.map((loc, i) => `
          <label class="cursor-pointer">
            <input type="radio" name="pickup_location" value="${loc.name}" ${i === 0 ? 'checked' : ''} class="peer sr-only" />
            <div class="flex items-center gap-3 p-4 border border-outline-variant rounded-xl peer-checked:border-primary peer-checked:bg-primary-fixed/10 hover:bg-surface-container-low transition-all">
              <span class="material-symbols-outlined text-on-surface-variant peer-checked:text-primary">location_on</span>
              <div>
                <p class="text-label-md font-bold text-on-surface">${loc.name}</p>
              </div>
            </div>
          </label>
        `).join('');
        if (!selectedPickupValue) {
          selectedPickupValue = locations[0]?.name || '';
        }
        container.querySelectorAll('input[name="pickup_location"]').forEach(r => {
          r.addEventListener('change', () => {
            selectedPickupValue = container.querySelector('input[name="pickup_location"]:checked')?.value || '';
          });
        });
      }
    } catch (err) {
      console.error('Error loading pickup locations:', err);
      if (pickupContainer) {
        pickupContainer.innerHTML = '<div class="col-span-2 text-center text-error py-4 text-label-sm">' + t('newReq.loadError') + '</div>';
      }
    }
  };
  loadPickupLocations();

  // ── Load Templates from DB (เมนูจัดการเทมเพลต) ───────────────────
  const TEMPLATE_CATEGORY_ICONS = {
    'หนังสือรับรองการทำงาน': 'badge',
    'หนังสือรับรองเงินเดือน': 'payments',
    'หนังสือรับรองเพื่อทำวีซ่า': 'flight_takeoff',
    'อื่นๆ': 'article',
  };
  const TEMPLATE_CATEGORY_DOC_TYPE = {
    'หนังสือรับรองการทำงาน': 'work',
    'หนังสือรับรองเงินเดือน': 'salary',
    'หนังสือรับรองเพื่อทำวีซ่า': 'visa',
    'อื่นๆ': 'work',
  };

  function getDocTypeFromTemplate(tmpl) {
    // หากชื่อเทมเพลตมีคำว่า "ต่างประเทศ" หรือ "abroad" ให้เป็น abroad type
    if ((tmpl.name || '').match(/ต่างประเทศ|abroad/i)) return 'abroad';
    return TEMPLATE_CATEGORY_DOC_TYPE[tmpl.category] || 'work';
  }

  const loadTemplates = async () => {
    const selectorContainer = container.querySelector('#template-selector-container');
    if (!selectorContainer) return;
    try {
      const res = await getTemplates();
      const all = res.data || res || [];
      // กรองเฉพาะเทมเพลตที่ published (เหมือนกับที่ HR เห็นในเมนูจัดการเทมเพลต)
      const published = all.filter(tmpl => tmpl.status === 'published');

      if (published.length === 0) {
        selectorContainer.innerHTML = `
          <div class="col-span-2 flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-outline-variant/40 rounded-xl">
            <span class="material-symbols-outlined text-4xl text-outline-variant mb-3">description_off</span>
            <p class="text-label-md font-bold text-on-surface-variant">ยังไม่มีเทมเพลตที่พร้อมใช้งาน</p>
            <p class="text-label-sm text-outline mt-1">กรุณาติดต่อ HR Admin เพื่อเปิดใช้งานเทมเพลตในเมนูจัดการเทมเพลต</p>
          </div>
        `;
        return;
      }

      selectorContainer.innerHTML = published.map((tmpl, i) => {
        const docType = getDocTypeFromTemplate(tmpl);
        const icon = tmpl.icon || TEMPLATE_CATEGORY_ICONS[tmpl.category] || 'description';
        const safeName = (tmpl.name || '').replace(/"/g, '&quot;');
        const safeCategory = (tmpl.category || '').replace(/"/g, '&quot;');
        return `
          <label class="radio-card cursor-pointer" id="template-label-${tmpl.id}">
            <input ${i === 0 ? 'checked' : ''}
              class="peer sr-only doc-type-radio template-radio"
              name="doc_type"
              type="radio"
              value="${tmpl.id}"
              data-doc-type="${docType}"
              data-template-id="${tmpl.id}"
              data-template-name="${safeName}"
              data-category="${safeCategory}" />
            <div class="flex flex-col gap-2 p-5 border-2 border-outline-variant rounded-xl transition-all peer-checked:border-primary peer-checked:bg-primary-fixed/20 peer-checked:shadow-sm hover:bg-surface-container-low h-full">
              <span class="material-symbols-outlined text-2xl text-on-surface-variant peer-checked:text-primary" style="font-variation-settings:'FILL' 1">${icon}</span>
              <p class="text-label-md font-bold text-on-surface">${tmpl.name}</p>
              <p class="text-label-sm text-outline leading-snug">${tmpl.category || ''}</p>
            </div>
          </label>
        `;
      }).join('');

      // Attach event listeners หลังจาก render template radio cards แล้ว
      container.querySelectorAll('.doc-type-radio').forEach(r => r.addEventListener('change', updateDocTypeDefaults));

      // ตั้งค่า default ตาม template แรกที่ถูกเลือก
      updateDocTypeDefaults();

    } catch (err) {
      console.error('Error loading templates:', err);
      if (selectorContainer) {
        selectorContainer.innerHTML = `
          <div class="col-span-2 text-center text-error py-4 text-label-sm flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-[18px]">error</span>
            เกิดข้อผิดพลาดในการโหลดเทมเพลต กรุณาลองใหม่อีกครั้ง
          </div>
        `;
      }
    }
  };
  loadTemplates();

  // ── FAQ Accordion ──────────────────────────────────────────────
  container.querySelectorAll('.faq-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.getAttribute('data-faq');
      const answer = btn.nextElementSibling;
      const icon   = btn.querySelector('.faq-icon');
      const isOpen = !answer.classList.contains('hidden');
      // close all
      container.querySelectorAll('.faq-answer').forEach(a => a.classList.add('hidden'));
      container.querySelectorAll('.faq-icon').forEach(i => i.style.transform = '');
      if (!isOpen) {
        answer.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
      }
    });
  });

  // ── File upload ────────────────────────────────────────────────
  const dropzone = container.querySelector('#file-dropzone');
  const fileInput = container.querySelector('#file-input');
  const fileList  = container.querySelector('#file-list');

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.replace('border-outline-variant', 'border-primary');
    dropzone.classList.add('bg-primary-fixed/10');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.replace('border-primary', 'border-outline-variant');
    dropzone.classList.remove('bg-primary-fixed/10');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.replace('border-primary', 'border-outline-variant');
    dropzone.classList.remove('bg-primary-fixed/10');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => handleFiles(fileInput.files));

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function addFileItem(name, size) {
    const kb = (size / 1024).toFixed(1);
    const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const li = document.createElement('li');
    li.id = fileId;
    li.className = 'flex items-center justify-between gap-3 px-4 py-3 bg-surface-container-low rounded-lg border border-outline-variant/20';
    li.innerHTML = `
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <span class="material-symbols-outlined text-outline-variant text-xl">description</span>
        <div class="min-w-0 flex-1">
          <p class="text-label-sm font-medium text-on-surface truncate">${escapeHtml(name)}</p>
          <p class="text-label-xs text-outline-variant">${kb} KB</p>
        </div>
      </div>
      <div class="file-status flex items-center gap-2">
        <span class="text-label-xs text-outline-variant">${t('newReq.filePending')}</span>
        <button class="btn-remove-file text-on-surface-variant hover:text-error transition-colors p-1" data-file-id="${fileId}">
          <span class="material-symbols-outlined text-lg">close</span>
        </button>
      </div>
    `;
    fileList.appendChild(li);
    li.querySelector('.btn-remove-file').addEventListener('click', () => {
      const idx = uploadedFiles.findIndex(f => f.fileId === fileId);
      if (idx !== -1) uploadedFiles.splice(idx, 1);
      li.remove();
    });
    return fileId;
  }

  function handleFiles(files) {
    const MAX_TOTAL = 20 * 1024 * 1024;
    let currentTotal = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
    for (const file of files) {
      if (currentTotal + file.size > MAX_TOTAL) {
        alert(t('newReq.fileSizeAlert'));
        break;
      }
      currentTotal += file.size;
      const fileId = addFileItem(file.name, file.size);
      uploadedFiles.push({ file, fileId, size: file.size, name: file.name });
    }
    fileInput.value = '';
  }

  // ── Preview Modal ──────────────────────────────────────────────
  const previewModal   = container.querySelector('#preview-modal');
  const openPreview    = () => { previewModal?.classList.remove('hidden'); document.body.style.overflow = 'hidden'; };
  const closePreview   = () => { previewModal?.classList.add('hidden'); document.body.style.overflow = ''; };

  const docTypeLabels = { work: t('newReq.workCert'), salary: t('newReq.salaryCert'), visa: t('newReq.visaCert'), abroad: t('newReq.abroadCert') };
  const purposeLabels = { bank: t('newReq.purposeBank'), visa: t('newReq.purposeVisa'), abroad: t('newReq.purposeAbroad'), study: t('newReq.purposeStudy'), other: t('newReq.purposeOther') };

  function collectExtraFields(docType, purpose) {
    const showAbroad = purpose === 'abroad' || docType === 'abroad';
    const abroadDestination = container.querySelector('#abroad-destination')?.value?.trim() || '';
    const abroadStartDate = container.querySelector('#abroad-start-date')?.value || '';
    const abroadEndDate = container.querySelector('#abroad-end-date')?.value || '';
    const visaCountry = container.querySelector('#visa-country')?.value?.trim() || '';
    const visaTravelDate = container.querySelector('#visa-travel-date')?.value || '';
    const institutionName = container.querySelector('#institution-name')?.value?.trim() || '';
    const otherPurpose = container.querySelector('#other-purpose')?.value?.trim() || '';
    return {
      abroad_destination: showAbroad ? abroadDestination : '',
      abroad_start_date: showAbroad ? abroadStartDate : '',
      abroad_end_date: showAbroad ? abroadEndDate : '',
      visa_country: showAbroad ? abroadDestination : (purpose === 'visa' ? visaCountry : ''),
      visa_travel_date: purpose === 'visa' ? visaTravelDate : '',
      institution_name: institutionName,
      other_purpose: otherPurpose,
    };
  }
  const langLabels    = { th: t('newReq.langThai'), en: t('newReq.langEng'), both: t('newReq.langBoth') };
  const deliveryLabels= { digital: t('newReq.deliveryDigital'), physical: t('newReq.deliveryPhysical') };

  container.querySelector('#btn-preview-request')?.addEventListener('click', () => {
    const curUser = getCurrentUser();
    const empTarget = (targetEmployee) ? targetEmployee : curUser;
    const docType  = getSelectedDocType();
    const selectedTplPreviewEl = container.querySelector('.doc-type-radio:checked');
    const purpose  = container.querySelector('.purpose-radio:checked')?.value;
    const isEng = (selectedTplPreviewEl?.dataset?.templateName || '').toLowerCase().includes('eng') || (selectedTplPreviewEl?.dataset?.templateName || '').toLowerCase().includes('en') || (selectedTplPreviewEl?.dataset?.templateId || '').toLowerCase().includes('en');
    const lang = isEng ? 'en' : 'th';
    const salary   = container.querySelector('#salary-yes')?.checked ? t('common.yes') : t('common.no');
    const deliveryArr = Array.from(container.querySelectorAll('input[name="delivery"]:checked')).map(c => c.value);
    const extra    = collectExtraFields(docType, purpose);
    const notes    = container.querySelector('#notes-textarea')?.value?.trim() || '';
    const pickupLoc = deliveryArr.includes('physical') ? (container.querySelector('input[name="pickup_location"]:checked')?.value || '') : '';

    // Update Employee preview fields dynamically
    const previewEmpCode = container.querySelector('#preview-emp-code');
    const previewFullName = container.querySelector('#preview-full-name');
    const previewPosition = container.querySelector('#preview-position');
    const previewDepartment = container.querySelector('#preview-department');
    const previewCompany = container.querySelector('#preview-company');

    if (previewEmpCode) previewEmpCode.textContent = empTarget?.emp_id || empTarget?.empCode || '';
    if (previewFullName) previewFullName.textContent = empTarget?.full_name || empTarget?.name || '';
    if (previewPosition) previewPosition.textContent = empTarget?.position || '';
    if (previewDepartment) previewDepartment.textContent = empTarget?.department || '';
    if (previewCompany) previewCompany.textContent = empTarget?.company_name || empTarget?.companyName || '';

    container.querySelector('#preview-doc-type').textContent = docTypeLabels[docType] || '-';
    container.querySelector('#preview-purpose').textContent  = purposeLabels[purpose] || '-';
    container.querySelector('#preview-language').textContent = langLabels[lang] || '-';
    container.querySelector('#preview-salary').textContent   = salary;
    const deliveryDisplay = deliveryArr.map(d => deliveryLabels[d] || d).join(', ') || '-';
    container.querySelector('#preview-delivery').textContent = deliveryDisplay;

    // Additional purpose details
    const purposeExtraParts = [];
    if (docType === 'visa' || purpose === 'visa') {
      if (extra.visa_country) purposeExtraParts.push(`${t('newReq.labelVisaCountry')}: ${extra.visa_country}`);
      if (extra.visa_travel_date) purposeExtraParts.push(`${t('newReq.labelTravelDate')}: ${extra.visa_travel_date}`);
    }
    if (docType === 'abroad' || purpose === 'abroad') {
      if (extra.abroad_destination) purposeExtraParts.push(`${t('newReq.labelAbroadDestination')}: ${extra.abroad_destination}`);
      if (extra.abroad_start_date) purposeExtraParts.push(`${t('newReq.labelAbroadStartDate')}: ${extra.abroad_start_date}`);
      if (extra.abroad_end_date) purposeExtraParts.push(`${t('newReq.labelAbroadEndDate')}: ${extra.abroad_end_date}`);
    }
    if (purpose === 'bank' || purpose === 'study') {
      if (extra.institution_name) purposeExtraParts.push(`${t('newReq.labelInstitution')}: ${extra.institution_name}`);
    }
    if (purpose === 'other') {
      if (extra.other_purpose) purposeExtraParts.push(`${t('newReq.labelOtherPurpose')}: ${extra.other_purpose}`);
    }
    container.querySelector('#preview-purpose-extra').textContent = purposeExtraParts.length > 0 ? purposeExtraParts.join(', ') : '-';

    // Notes
    container.querySelector('#preview-notes').textContent = notes || '-';

    // Pickup location (only for physical delivery)
    const pickupRow = container.querySelector('#preview-pickup-row');
    const pickupEl  = container.querySelector('#preview-pickup-location');
    if (deliveryArr.includes('physical') && pickupLoc) {
      pickupRow?.classList.remove('hidden');
      pickupEl?.classList.remove('hidden');
      pickupEl.textContent = pickupLoc;
    } else {
      pickupRow?.classList.add('hidden');
      pickupEl?.classList.add('hidden');
    }

    openPreview();
  });

  container.querySelector('#preview-modal-close')?.addEventListener('click', closePreview);
  container.querySelector('#preview-modal-backdrop')?.addEventListener('click', closePreview);
  container.querySelector('#preview-edit-btn')?.addEventListener('click', closePreview);

  // ── Submit ─────────────────────────────────────────────────────
  const submitBtn = container.querySelector('#btn-submit-request');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      // ── Validate delivery method (must pick at least one) ──
      const deliveryArr = Array.from(container.querySelectorAll('input[name="delivery"]:checked')).map(c => c.value);
      if (deliveryArr.length === 0) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = t('newReq.previewSubmitBtn');
        const deliverySection = container.querySelector('#delivery-section');
        deliverySection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        deliverySection?.classList.add('ring-2', 'ring-error', 'rounded-lg');
        setTimeout(() => deliverySection?.classList.remove('ring-2', 'ring-error', 'rounded-lg'), 2500);
        showToast(t('newReq.deliveryRequired') || 'กรุณาเลือกรูปแบบการรับเอกสาร', 'error');
        return;
      }
      // Physical delivery requires a pickup location
      if (deliveryArr.includes('physical')) {
        const pickupLoc = container.querySelector('input[name="pickup_location"]:checked')?.value;
        if (!pickupLoc) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = t('newReq.previewSubmitBtn');
          const pickupSection = container.querySelector('#physical-location-picker');
          pickupSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          pickupSection?.classList.add('ring-2', 'ring-error', 'rounded-lg');
          setTimeout(() => pickupSection?.classList.remove('ring-2', 'ring-error', 'rounded-lg'), 2500);
          showToast(t('newReq.pickupRequired') || 'กรุณาเลือกสถานที่รับเอกสาร', 'error');
          return;
        }
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">sync</span> ' + t('newReq.submitting');

      try {
        const uploadedKeys = [];
        for (const item of uploadedFiles) {
          const statusEl = document.getElementById(item.fileId)?.querySelector('.file-status');
          if (statusEl) statusEl.innerHTML = '<span class="text-primary text-label-xs animate-pulse">' + t('newReq.uploading') + '</span>';
          const result = await uploadFile(item.file, 'supporting-docs');
          uploadedKeys.push({ key: result.key, name: result.name, size: result.size });
          if (statusEl) statusEl.innerHTML = '<span class="text-success text-label-xs">' + t('newReq.uploadSuccess') + '</span>';
        }

        const selectedTplEl = container.querySelector('.doc-type-radio:checked');
        const docType  = getSelectedDocType();
        const templateId = selectedTplEl?.dataset?.templateId || '';
        const templateName = selectedTplEl?.dataset?.templateName || '';
        const purpose  = container.querySelector('.purpose-radio:checked')?.value;
        const isEng = (selectedTplEl?.dataset?.templateName || '').toLowerCase().includes('eng') || (selectedTplEl?.dataset?.templateName || '').toLowerCase().includes('en') || (selectedTplEl?.dataset?.templateId || '').toLowerCase().includes('en');
        const lang = isEng ? 'en' : 'th';
        const salary   = container.querySelector('#salary-yes')?.checked ? t('common.yes') : t('common.no');
        const deliveryArr = Array.from(container.querySelectorAll('input[name="delivery"]:checked')).map(c => c.value);
        const pickupLoc = deliveryArr.includes('physical') ? (container.querySelector('input[name="pickup_location"]:checked')?.value || '') : '';
        const today = new Date();
        const formatThaiDateShort = (d) => {
        const months = t('month.short');
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
        };
        const dateStr = formatThaiDateShort(today);
        const idStr = 'EC-' + today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0') + '-' + String(Math.floor(Math.random() * 9000) + 1000);
        const curUser = getCurrentUser();
        const selectedHrRadio = container.querySelector('input[name="selected_hr"]:checked');
        const selectedHrRow = selectedHrRadio ? selectedHrRadio.closest('tr') : null;
        const selectedHrInfo = selectedHrRow ? {
          emp_id: selectedHrRadio.value,
          name: selectedHrRow.querySelector('.text-body-md.font-semibold')?.textContent?.trim() || '',
        } : {};
        const extra = collectExtraFields(docType, purpose);
        const notes = container.querySelector('#notes-textarea')?.value?.trim() || '';

        // Resolve employee info: use targetEmployee (on-behalf OR resubmit), else curUser
        const empTarget = (targetEmployee) ? targetEmployee : curUser;

        // Add to employeeRequests
        const newReq = {
          id: idStr,
          date: dateStr,
          type: templateName || docTypeLabels[docType] || t('newReq.workCert'),
          doc_type: docType,
          template_id: templateId,
          template_name: templateName,
          purpose: purposeLabels[purpose] || '-',
          purpose_value: purpose,
          language: langLabels[lang] || '-',
          salary: salary,
          delivery: deliveryArr.map(d => deliveryLabels[d] || d).join(', ') || '-',
          delivery_value: deliveryArr.join(', '),
          pickup_location: pickupLoc,
          abroad_destination: extra.abroad_destination,
          abroad_start_date: extra.abroad_start_date,
          abroad_end_date: extra.abroad_end_date,
          visa_country: extra.visa_country,
          visa_travel_date: extra.visa_travel_date,
          institution_name: extra.institution_name,
          other_purpose: extra.other_purpose,
          notes,
          status: 'in-review',
          statusLabel: t('newReq.defaultStatus'),
          canCancel: true,
          canDownload: false,
          attachments: uploadedKeys,
          // Employee identity (target employee in on-behalf mode)
          emp_id: empTarget?.emp_id || empTarget?.empCode || '',
          full_name: empTarget?.full_name || empTarget?.name || '',
          position: empTarget?.position || '',
          department: empTarget?.department || '',
          company_name: empTarget?.company_name || empTarget?.companyName || '',
          start_date: empTarget?.start_date || empTarget?.startDate || '',
          user_id: empTarget?.id || null,
          user_email: empTarget?.email || '',
          username: empTarget?.username || '',
          phone: empTarget?.phone || '',
          sex_id: empTarget?.sex_id || '',
          fname_e: empTarget?.fname_e || '',
          lname_e: empTarget?.lname_e || '',
          hr_officer: selectedHrInfo,
          // On-behalf metadata
          ...(isOnBehalf ? {
            on_behalf_of_emp_id: empTarget?.emp_id || empTarget?.empCode || onBehalfEmpId,
            on_behalf_of_name: empTarget?.full_name || empTarget?.name || '',
            created_by_emp_id: curUser?.emp_id || curUser?.empCode || '',
            created_by_name: curUser?.full_name || curUser?.name || '',
          } : {}),
        };

        const result = await createRequest(newReq);
        const savedReq = result?.request || newReq;
        const savedId = savedReq.id || savedReq.request_code || idStr;

        // Update activeTracker
        const newTracker = {
          id: savedId,
          attachments: uploadedKeys,
          steps: [
            { label: t('step.submitted'), date: dateStr, icon: 'check', completed: true },
            { label: t('step.review'), date: dateStr, icon: 'assignment_turned_in', completed: true },
            { label: t('step.approve'), date: t('status.inProgress'), icon: 'rate_review', completed: true, active: true },
            { label: t('step.delivery'), date: t('status.pending'), icon: 'verified', completed: false }
          ]
        };
        localStorage.setItem('hrbp_active_tracker', JSON.stringify(newTracker));

        console.log('=== New Request Submitted ===');
        console.log('Uploaded files:', uploadedKeys);

        closePreview();
        showToast(t('newReq.submitSuccess'), 'check_circle');
        // Redirect back: admin/requests if HR submitted on behalf, else employee requests
        const redirectPath = isOnBehalf ? '/admin/requests' : '/employee/requests';
        setTimeout(() => navigate(redirectPath), 1800);
      } catch (err) {
        console.error('Submit error:', err);
        showToast(t('common.error') + ': ' + err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">send</span> ' + t('newReq.previewSubmitBtn');
      }
    });
  }

  // ── Load HR list ───────────────────────────────────────────────
  const tbody = container.querySelector('#hr-officers-tbody');
  if (tbody) {
    try {
      const result  = await getUsers();
      const hrList  = (result.users || []).filter(u => u.status === 'active').filter(u =>
        ['admin', 'hrbp', 'hr'].includes(u.role) ||
        (u.position || '').match(/hr|human\s*resource|บุคลากร|ทรัพยากรบุคคล/i) ||
        (u.department || '').match(/hr|people|human\s*resource|บุคลากร|ทรัพยากรบุคคล/i)
      );

      if (hrList.length > 0) {
        tbody.innerHTML = hrList.map((officer, index) => {
          const buDisplay = Array.isArray(officer.responsible_bu)
            ? officer.responsible_bu.map(b => `<span class="inline-block px-2 py-0.5 bg-primary-fixed/20 text-primary text-xs rounded border border-primary/10 mr-1 mb-1 font-semibold">${b}</span>`).join('')
            : (officer.responsible_bu ? `<span class="inline-block px-2 py-0.5 bg-primary-fixed/20 text-primary text-xs rounded border border-primary/10 font-semibold">${officer.responsible_bu}</span>` : '-');

          const initials = (officer.full_name || 'HR').substring(0, 2);
          const avatarHtml = officer.emp_id
            ? `<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-avatar-emp-id="${officer.emp_id}" class="w-8 h-8 rounded-full object-cover border border-outline-variant/40" onerror="this.onerror=null; this.outerHTML=\`<div class='w-8 h-8 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-xs'>${initials}</div>\`;" />`
            : `<div class="w-8 h-8 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-xs">${initials}</div>`;

          return `
            <tr class="border-b border-outline-variant/30 last:border-b-0 hover:bg-surface-container-lowest transition-colors cursor-pointer hr-row" data-id="${officer.emp_id}">
              <td class="p-4 text-center">
                <input type="radio" name="selected_hr" value="${officer.emp_id}" ${index === 0 ? 'checked' : ''} class="w-4 h-4 text-primary focus:ring-primary/20 cursor-pointer" />
              </td>
              <td class="p-4">
                <div class="flex items-center gap-3">
                  ${avatarHtml}
                  <span class="text-body-md font-semibold text-on-surface">${officer.full_name || '-'}</span>
                </div>
              </td>
              <td class="p-4 text-body-md font-medium">${buDisplay}</td>
              <td class="p-4 text-center text-body-md font-medium text-on-surface-variant">${officer.phone || '-'}</td>
            </tr>
          `;
        }).join('');

        tbody.querySelectorAll('img[data-avatar-emp-id]').forEach(img => {
          loadAvatarForElement(img, img.getAttribute('data-avatar-emp-id'));
        });
        tbody.querySelectorAll('.hr-row').forEach(row => {
          row.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
              const radio = row.querySelector('input[type="radio"]');
              if (radio) radio.checked = true;
            }
          });
        });
      } else {
        tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-on-surface-variant font-medium">${t('newReq.noHr')}</td></tr>`;
      }
    } catch (err) {
      console.error('Error fetching HR officers:', err);
      tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-error font-medium">${t('newReq.loadError')}</td></tr>`;
    }
  }

  // ── Cancel button ────────────────────────────────────────────
  container.querySelector('#btn-cancel-request')?.addEventListener('click', () => {
    if (confirm(t('newReq.cancelConfirm'))) {
      navigate('/employee/requests');
    }
  });

  // ── Keyboard: Escape ──────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') closePreview();
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}
