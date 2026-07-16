/**
 * Employee: หน้าหลัก (My Requests Page)
 */
import { activeTracker, getCurrentUser } from '../mock-data.js';
import { navigate } from '../router.js';
import { downloadCertificatePdf, printCertificate, previewCertificate, buildCertDataFromRequest } from '../lib/templates.js';
import { t, getLang } from '../lib/i18n.js';
import {
  enrichRequestDownloadAccess,
  formatIsoDateDisplay,
  isDownloadWindowOpen,
} from '../lib/download-policy.js';
import { dataService } from '../lib/data-service.js';
import { getHrmsEmployee } from '../lib/api.js';

let currentRequestsData = { requests: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } };
let currentSearch = '';
let currentStatus = '';

// Base path for employee routes
function getRequestBase() {
  return '/employee';
}

function getStatusBadge(status, label) {
  const classes = {
    'submitted':     'bg-primary/10 text-primary',
    'in-review':     'bg-[#fef3c7] text-[#92400e]',
    'in-review-eta': 'bg-[#dce1ff] text-primary',
    'approved':      'bg-[#dcfce7] text-[#166534]',
    'rejected':      'bg-[#fee2e2] text-[#991b1b]',
    'cancelled':     'bg-surface-container-highest text-outline',
    'draft':         'bg-surface-container-highest text-on-surface-variant',
  };
  return `<span class="px-3 py-1 rounded-full text-label-sm font-bold whitespace-nowrap ${classes[status] || classes.draft}">${label}</span>`;
}

/** คำนวณวันทำการ (ข้ามเสาร์-อาทิตย์) */
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
  const year = getLang() === 'en' ? date.getFullYear() : date.getFullYear() + 543;
  return `${date.getDate()} ${months[date.getMonth()]} ${year}`;
}

function formatStoredDate(dateStr) {
  if (!dateStr) return '';
  const iso = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
    return formatThaiDate(d);
  }
  return dateStr;
}

function getReviewStepInfo(req, statusIndex) {
  if (req.eta_date && req.eta_submitted_at) {
    return {
      date: t('employeeReq.stepDateInProgress'),
      subdate: `${req.acknowledged_by ? 'โดย ' + req.acknowledged_by + ' • ' : ''}${formatStoredDate(req.eta_submitted_at)}`,
    };
  }
  if (req.status === 'in-review' || (req.status === 'submitted' && req.eta_date)) {
    return { date: t('employeeReq.stepDateInProgress'), subdate: req.acknowledged_by ? 'โดย ' + req.acknowledged_by : '' };
  }
  return { date: t('employeeReq.stepDatePending') };
}

/**
 * Backend stores employee-cancelled requests as status='rejected' with the flag
 * request_data.cancelled_by_employee = true (because the requests.status CHECK
 * constraint disallows 'cancelled'). This helper centralizes that lookup so we
 * don't have to remember in every render path.
 */
function isEmployeeCancelled(req) {
  if (!req) return false;
  if (req.status === 'cancelled') return true;
  if (req.cancelled_by_employee === true) return true;
  const meta = req.request_data || {};
  return meta.cancelled_by_employee === true;
}

/** Render the <tr> rows for a given list of (already-visible) requests */
function renderTableRows(visibleRequests) {
  if (!visibleRequests || visibleRequests.length === 0) {
    return `<tr><td colspan="7" class="px-6 py-16 text-center text-on-surface-variant">${t('common.noResults')}</td></tr>`;
  }
  return visibleRequests.map(reqRaw => {
    const req = enrichRequestDownloadAccess(reqRaw);
    const attachments = (() => {
      try { return JSON.parse(req.supporting_docs || '[]'); } catch { return []; }
    })();
    const dateStr = req.date || req.created_at || '';
    const typeStr = req.type || req.purpose || '';
    const hasEta = !!req.eta_date;
    const isCertReady = !!req.cert_ready;
    const statusLabelMap = { 'submitted': t('status.submitted'), 'in-review': t('status.inReview'), 'approved': t('status.approved'), 'rejected': t('status.rejected'), 'cancelled': t('status.cancelled') };
    const effectiveLabel = isCertReady ? t('status.approved') : (req.status === 'in-review' && hasEta ? t('status.inProgress') : (isEmployeeCancelled(req) ? t('status.cancelled') : (statusLabelMap[req.status] || req.statusLabel || req.status_label || req.status)));
    const effectiveStatus = isCertReady || req.status === 'approved' ? 'approved' : (isEmployeeCancelled(req) ? 'cancelled' : (req.status === 'rejected' ? 'rejected' : (hasEta ? 'in-review-eta' : req.status)));
    const etaDisplay = hasEta ? (() => {
      const parts = req.eta_date.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const months = t('month.short');
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
      }
      return req.eta_date;
    })() : '';
    return `
      <tr class="hover:bg-surface-container-low transition-colors cursor-pointer request-row" data-id="${req.id || req.request_code}" data-status="${req.status}" data-type="${typeStr}" data-date="${dateStr}" data-status-label="${effectiveLabel}" data-attachments='${JSON.stringify(attachments)}' data-eta="${req.eta_date || ''}" data-cert-ready="${req.cert_ready ? 'true' : ''}">
        <td class="px-6 py-5 text-label-md font-bold text-primary">${req.id || req.request_code}</td>
        <td class="px-6 py-5 text-body-md text-on-surface-variant">${dateStr}</td>
        <td class="px-6 py-5 text-body-md text-on-surface">${typeStr}</td>
        <td class="px-6 py-5">${attachments.length > 0 ? `<span class="inline-flex items-center gap-1 text-label-sm text-primary"><span class="material-symbols-outlined text-[16px]">attach_file</span>${attachments.length} ${t('employeeReq.fileCount')}</span>` : '<span class="text-label-sm text-outline">-</span>'}</td>
        <td class="px-6 py-5">
          ${getStatusBadge(effectiveStatus, effectiveLabel)}
        </td>
        <td class="px-6 py-5 text-body-md">
          ${etaDisplay ? `<span class="text-primary font-bold">${etaDisplay}</span>` : '<span class="text-outline">-</span>'}
        </td>
        <td class="px-6 py-5 text-right">
          <div class="flex justify-end gap-2 items-center">
            <button class="p-2 hover:bg-surface-container rounded-lg transition-colors text-primary btn-view" data-id="${req.id || req.request_code}" title="${t('employeeReq.modalTitle')}">
              <span class="material-symbols-outlined">visibility</span>
            </button>
            ${(req.can_download || req.canDownload) ? `
              <button class="p-2 hover:bg-surface-container rounded-lg transition-colors text-primary btn-download" data-id="${req.id || req.request_code}" title="${t('common.download')}">
                <span class="material-symbols-outlined">download</span>
              </button>
            ` : ''}
            ${req.can_cancel || req.canCancel ? `
              <button class="p-2 hover:bg-surface-container rounded-lg transition-colors text-outline hover:text-error btn-cancel" data-id="${req.request_code || req.id}" title="${t('common.cancel')}">
                <span class="material-symbols-outlined">close</span>
              </button>
            ` : ''}
            ${req.can_resubmit || req.canResubmit ? `
              <button class="px-3 py-1 bg-primary text-on-primary rounded-lg text-label-sm hover:opacity-90 transition-opacity btn-resubmit" data-id="${req.id || req.request_code}">${t('common.resubmit')}</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/** Render pagination HTML for a given visible-request list + pagination meta */
function renderPaginationHTML(visibleRequests, pagination = currentRequestsData?.pagination) {
  if (!pagination || visibleRequests.length <= 0) return '';
  const { page, limit } = pagination;
  const visibleTotal = visibleRequests.length;
  const totalPages = Math.ceil(visibleTotal / limit);
  const safePage = Math.min(page, totalPages);
  const start = visibleTotal === 0 ? 0 : (safePage - 1) * limit + 1;
  const end = Math.min(safePage * limit, visibleTotal);

  let pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  return `
    <div class="flex items-center justify-between">
      <p class="text-label-md text-outline">${t('common.showing')} ${start} ${t('common.to')} ${end} ${t('common.from')} ${visibleTotal} ${t('common.items')}</p>
      <div class="flex gap-2">
        <button class="btn-page p-2 border border-outline-variant rounded-lg hover:bg-surface-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed" data-page="${safePage - 1}" ${safePage <= 1 ? 'disabled' : ''}>
          <span class="material-symbols-outlined">chevron_left</span>
        </button>
        ${pages.map(p => `
          <button class="btn-page px-4 py-2 rounded-lg text-label-md font-medium transition-colors ${p === safePage ? 'bg-primary text-on-primary font-bold' : 'border border-outline-variant hover:bg-surface-container'}" data-page="${p}">${p}</button>
        `).join('')}
        <button class="btn-page p-2 border border-outline-variant rounded-lg hover:bg-surface-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed" data-page="${safePage + 1}" ${safePage >= totalPages ? 'disabled' : ''}>
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    </div>
  `;
}

/** สร้าง steps จากสถานะของ request */
function buildStepsForRequest(req) {
  const statusOrder = ['submitted', 'in-review', 'approved', 'rejected'];
  const statusIndex = statusOrder.indexOf(req.status);

  const reviewStep = getReviewStepInfo(req, statusIndex);
  const allSteps = [
    { key: 'submitted', icon: 'send',        label: t('step.submitted'),           date: req.date || '' },
    { key: 'in-review', icon: 'manage_search', label: t('step.review'),    date: reviewStep.date, subdate: reviewStep.subdate || '' },
    { key: 'approved',  icon: 'task_alt',    label: t('step.approve'), date: req.status === 'approved' ? t('employeeReq.stepDateApproved') : req.status === 'rejected' ? t('employeeReq.stepDateRejected') : t('employeeReq.stepDatePending') },
    { key: 'done',      icon: 'inventory',   label: t('step.delivery'),      date: req.status === 'approved' ? t('employeeReq.stepDateReady') : t('employeeReq.stepDatePending') },
  ];

  return allSteps.map((step, i) => {
    let completed = false;
    let active = false;

    if (req.status === 'submitted')  { completed = i === 0; active = i === 0; }
    else if (req.status === 'in-review') {
      if (req.eta_date) {
        // HR รับเคสแล้ว → อยู่ระหว่างดำเนินการ
        completed = i <= 1; active = i === 1;
      } else {
        // รอ HR รับทราบเคส → ไฮไลท์แค่ส่งคำขอเท่านั้น
        completed = i === 0; active = i === 0;
      }
    }
    else if (req.status === 'approved')  { completed = true; active = i === 3; }
    else if (req.status === 'rejected')  { completed = i <= 2; active = i === 2; }

    return { ...step, completed, active };
  });
}

export function renderEmployeeRequests(data) {
  const user = getCurrentUser();
  currentRequestsData = data || { requests: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }, stats: { avg_days: 0, success_rate: 0, open_requests: 0 } };
  // Initialize dataService cache with the page data so that
  // cancel/update operations work correctly on this page.
  dataService.setData(currentRequestsData);
  currentSearch = sessionStorage.getItem('requests-search') || '';
  currentStatus = sessionStorage.getItem('requests-status') || '';
  const stats = currentRequestsData.stats || { avg_days: 0, success_rate: 0, open_requests: 0 };
  const { requests, pagination } = currentRequestsData;

  const renderRows = () => {
    const visibleRequests = currentStatus === 'cancelled'
      ? requests.filter(r => isEmployeeCancelled(r))
      : requests;
    return renderTableRows(visibleRequests);
  };

  const renderPagination = () => {
    const visibleRequests = currentStatus === 'cancelled'
      ? requests.filter(r => isEmployeeCancelled(r))
      : requests;
    return renderPaginationHTML(visibleRequests, pagination);
  };

  const isHrRole = user && user.role !== 'employee';

  return `
    <!-- Page Header -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <div>
        <h1 class="page-title">${t('employeeReq.pageTitle')}</h1>
        <p class="page-subtitle">${t('employeeReq.pageSubtitle')}</p>
      </div>
      <div class="flex gap-3 flex-wrap">
        ${isHrRole ? `
        <button id="btn-new-request-on-behalf" class="flex items-center gap-2 px-5 py-3 border-2 border-primary text-primary bg-white rounded-xl font-bold text-label-lg hover:bg-primary/5 active:scale-[0.97] transition-all">
          <span class="material-symbols-outlined">supervised_user_circle</span>
          สร้างคำขอให้พนักงาน
        </button>
        ` : ''}
        <button id="btn-new-request" class="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-label-lg hover:opacity-90 active:scale-[0.97] transition-all shadow-lg shadow-primary/25">
          <span class="material-symbols-outlined">add_circle</span>
          ${t('employeeReq.newRequestBtn')}
        </button>
      </div>
    </div>

    <!-- ===== On-Behalf Employee Search Modal ===== -->
    <div id="on-behalf-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 hidden">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" id="on-behalf-modal-backdrop"></div>
      <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        <div class="h-1.5 bg-primary w-full"></div>
        <div class="flex items-center justify-between px-6 pt-5 pb-3 border-b border-outline-variant">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-primary">supervised_user_circle</span>
            <h3 class="text-title-md font-bold text-on-surface">สร้างคำขอให้พนักงาน</h3>
          </div>
          <button id="on-behalf-modal-close" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-outline transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div class="px-6 py-5 space-y-4">
          <p class="text-body-sm text-on-surface-variant">พิมพ์รหัสพนักงาน (Employee ID) เพื่อค้นหาข้อมูล</p>
          <div class="relative">
            <label class="block text-label-md font-semibold text-on-surface-variant mb-2">รหัสพนักงาน <span class="text-error">*</span></label>
            <div class="flex gap-2">
              <input
                id="on-behalf-emp-id-input"
                type="text"
                placeholder="เช่น EMP-2024-001"
                class="flex-1 bg-white border border-outline-variant rounded-lg px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-on-surface font-medium"
              />
              <button id="on-behalf-search-btn" class="px-4 py-3 bg-primary text-on-primary rounded-lg font-bold hover:opacity-90 transition-opacity flex items-center gap-1">
                <span class="material-symbols-outlined text-[20px]">search</span>
              </button>
            </div>
          </div>

          <!-- Employee Preview -->
          <div id="on-behalf-employee-preview" class="hidden">
            <div class="bg-primary-fixed/20 border border-primary/20 rounded-xl p-4 space-y-2">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span class="material-symbols-outlined text-on-primary text-[20px]">person</span>
                </div>
                <div>
                  <p id="on-behalf-preview-name" class="text-label-md font-bold text-on-surface">-</p>
                  <p id="on-behalf-preview-empid" class="text-label-sm text-primary font-medium">-</p>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2 text-label-sm">
                <span class="text-on-surface-variant">ตำแหน่ง</span>
                <span id="on-behalf-preview-position" class="font-semibold text-on-surface truncate">-</span>
                <span class="text-on-surface-variant">แผนก</span>
                <span id="on-behalf-preview-dept" class="font-semibold text-on-surface truncate">-</span>
                <span class="text-on-surface-variant">บริษัท</span>
                <span id="on-behalf-preview-company" class="font-semibold text-on-surface truncate">-</span>
              </div>
            </div>
          </div>

          <!-- Not found message -->
          <div id="on-behalf-not-found" class="hidden">
            <div class="bg-error-container/40 border border-error/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <span class="material-symbols-outlined text-error shrink-0">person_off</span>
              <p class="text-label-sm text-on-surface-variant">ไม่พบพนักงานที่มีรหัสนี้ กรุณาตรวจสอบอีกครั้ง</p>
            </div>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-outline-variant flex gap-3">
          <button id="on-behalf-cancel-btn" class="flex-1 py-3 border border-outline-variant text-on-surface-variant font-bold rounded-xl hover:bg-surface-container transition-colors">
            ยกเลิก
          </button>
          <button id="on-behalf-confirm-btn" class="flex-[2] py-3 bg-primary text-on-primary font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed" disabled>
            <span class="material-symbols-outlined text-[18px]">edit_note</span>
            สร้างคำขอให้พนักงาน
          </button>
        </div>
      </div>
    </div>

    <!-- Insights Section -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex items-center gap-4 group hover:border-primary/30 transition-colors">
        <div class="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
          <span class="material-symbols-outlined">hourglass_empty</span>
        </div>
        <div>
          <p class="text-label-sm text-outline">${t('employeeReq.avgTime')}</p>
          <p class="text-headline-md font-bold text-on-surface">${stats.avg_days} ${t('employeeReq.days')}</p>
        </div>
      </div>
      <div class="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex items-center gap-4 group hover:border-primary/30 transition-colors">
        <div class="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
          <span class="material-symbols-outlined">fact_check</span>
        </div>
        <div>
          <p class="text-label-sm text-outline">${t('employeeReq.successRate')}</p>
          <p class="text-headline-md font-bold text-on-surface">${stats.success_rate}%</p>
        </div>
      </div>
      <div class="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex items-center gap-4 group hover:border-primary/30 transition-colors">
        <div class="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
          <span class="material-symbols-outlined">upcoming</span>
        </div>
        <div>
          <p class="text-label-sm text-outline">${t('employeeReq.openRequests')}</p>
          <p class="text-headline-md font-bold text-on-surface" id="stat-open-requests">${stats.open_requests}</p>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-4 mb-6 flex flex-col lg:flex-row gap-4">
      <div class="relative flex-grow">
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
        <input id="filter-search" class="w-full pl-10 pr-4 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all text-body-md" placeholder="${t('employeeReq.searchPlaceholder')}" type="text" value="${currentSearch}" />
      </div>
      <div class="flex gap-3 flex-wrap">
        <select id="filter-status" class="px-4 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface-variant font-label-md focus:border-primary outline-none min-w-[140px] cursor-pointer">
          <option value="">${t('employeeReq.filterAll')}</option>
          <option value="submitted" ${currentStatus === 'submitted' ? 'selected' : ''}>${t('status.submitted')}</option>
          <option value="in-review" ${currentStatus === 'in-review' ? 'selected' : ''}>${t('status.inReview')}</option>
          <option value="approved" ${currentStatus === 'approved' ? 'selected' : ''}>${t('status.approved')}</option>
          <option value="cancelled" ${currentStatus === 'cancelled' ? 'selected' : ''}>${t('status.cancelled')}</option>
        </select>
        <select id="filter-period" class="px-4 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface-variant font-label-md focus:border-primary outline-none min-w-[140px] cursor-pointer">
          <option value="">${t('employeeReq.period30d')}</option>
          <option value="3m">${t('employeeReq.period3m')}</option>
          <option value="2026">${t('employeeReq.period2026')}</option>
          <option value="all">${t('employeeReq.periodAll')}</option>
        </select>
        <button id="btn-clear-filter" class="px-4 py-2 bg-surface-container text-on-surface font-label-md rounded-lg hover:bg-surface-container-high transition-colors flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">filter_list_off</span>
          ${t('common.reset')}
        </button>
      </div>
    </div>

    <!-- Request Table -->
    <div class="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-surface-container-low border-b border-outline-variant">
              <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">${t('employeeReq.tableId')}</th>
              <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">${t('employeeReq.tableDate')}</th>
              <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">${t('employeeReq.tableType')}</th>
              <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">${t('employeeReq.tableAttach')}</th>
              <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">${t('employeeReq.tableStatus')}</th>
              <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">${t('employeeReq.tableEta')}</th>
              <th class="px-6 py-4 text-label-sm font-bold text-on-surface-variant uppercase tracking-wider text-right">${t('employeeReq.tableAction')}</th>
            </tr>
          </thead>
          <tbody id="requests-tbody" class="divide-y divide-outline-variant">
            ${renderRows()}
          </tbody>
        </table>
      </div>
      <!-- No results placeholder -->
      <div id="no-results" class="hidden p-16 text-center text-on-surface-variant">
        <span class="material-symbols-outlined text-[48px] text-outline mb-4 block">search_off</span>
        <p class="text-headline-md font-bold">${t('employeeReq.emptyTitle')}</p>
        <p class="text-body-md mt-1">${t('employeeReq.emptyHint')}</p>
      </div>
      <!-- Pagination -->
      <div id="pagination-wrapper" class="p-6 border-t border-outline-variant">
        ${renderPagination()}
      </div>
    </div>

    <!-- ===== Request Detail / Status Modal ===== -->
    <div id="tracker-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 hidden">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="tracker-modal-backdrop"></div>
      <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
        <div class="h-1.5 bg-primary w-full shrink-0"></div>
        <div class="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
          <h3 class="text-title-md font-bold text-on-surface">${t('employeeReq.modalTitle')}</h3>
          <button id="tracker-modal-close" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-outline transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div class="px-6 pb-6 overflow-y-auto flex-1" id="tracker-modal-body">
          <!-- populated dynamically -->
        </div>
      </div>
    </div>

    <!-- ===== Toast Notification ===== -->
    <div id="toast-notification" class="fixed inset-0 z-[200] flex items-center justify-center hidden">
      <div class="absolute inset-0 bg-black/30"></div>
      <div class="relative flex flex-col items-center gap-3 bg-surface-container-high border border-outline-variant px-8 py-6 rounded-2xl shadow-2xl text-label-md font-bold min-w-[300px] max-w-sm animate-[fadeIn_0.2s_ease-out]">
        <span id="toast-icon" class="material-symbols-outlined text-[36px] text-primary">check_circle</span>
        <span id="toast-message" class="text-on-surface text-center">${t('common.success')}</span>
      </div>
    </div>

    <!-- ===== Loading Overlay ===== -->
    <div id="loading-overlay" class="fixed inset-0 z-[150] flex items-center justify-center hidden">
      <div class="absolute inset-0 bg-black/20 backdrop-blur-sm"></div>
      <div class="relative flex flex-col items-center gap-4 bg-surface-container-lowest px-8 py-6 rounded-2xl shadow-2xl">
        <div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span id="loading-message" class="text-label-md font-bold text-on-surface">${t('common.loading')}</span>
      </div>
    </div>
  `;
}

export function initEmployeeRequests(container) {
  // ── Toast helper ──────────────────────────────────────────────
  const triggerDownloadPdfDirect = async (data, reqId) => {
    showToast('กำลังดาวน์โหลดไฟล์ PDF...', 'hourglass_top');
    try {
      await downloadCertificatePdf(data);
      showToast('ดาวน์โหลดสำเร็จ', 'download_done');
    } catch (err) {
      console.error('PDF download failed:', err);
      showToast('ไม่สามารถบันทึกไฟล์ได้', 'info');
    }
  };

  const triggerPrintPdf = async (data, reqId) => {
    try {
      await previewCertificate(data, false);
    } catch (err) {
      console.error('PDF preview failed:', err);
      showToast('ไม่สามารถเปิดเอกสารได้', 'info');
    }
  };

  const showToast = (message, icon = 'check_circle') => {
    const toast = container.querySelector('#toast-notification');
    const toastMsg = container.querySelector('#toast-message');
    const toastIcon = container.querySelector('#toast-icon');
    if (!toast) return;
    toastMsg.textContent = message;
    toastIcon.textContent = icon;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  };

  // ── Loading overlay helpers ─────────────────────────────────
  const showLoading = (message = t('common.loading')) => {
    const overlay = container.querySelector('#loading-overlay');
    const msgEl = container.querySelector('#loading-message');
    if (!overlay) return;
    if (msgEl) msgEl.textContent = message;
    overlay.classList.remove('hidden');
  };
  const hideLoading = () => {
    const overlay = container.querySelector('#loading-overlay');
    if (overlay) overlay.classList.add('hidden');
  };

  // ── Custom confirmation dialog (replaces native confirm()) ──────
  // Returns a Promise that resolves to true/false
  const showConfirmDialog = (message) => {
    return new Promise((resolve) => {
      let resolved = false;
      const doResolve = (val) => {
        if (resolved) return;
        resolved = true;
        dialog.remove();
        resolve(val);
      };

      const dialog = document.createElement('div');
      dialog.id = 'confirm-dialog';
      dialog.className = 'fixed inset-0 z-[999] flex items-center justify-center';
      dialog.innerHTML = `
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" data-action="dismiss"></div>
        <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 z-[1000]">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
              <span class="material-symbols-outlined text-error">warning</span>
            </div>
            <h3 class="text-title-md font-bold text-on-surface">${t('common.confirm')}</h3>
          </div>
          <p class="text-body-md text-on-surface-variant mb-6">${message}</p>
          <div class="flex gap-3 justify-end">
            <button data-action="cancel" class="px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant font-bold hover:bg-surface-container transition-colors">${t('common.cancel')}</button>
            <button data-action="ok" class="px-4 py-2 rounded-xl bg-error text-on-error font-bold hover:opacity-90 transition-opacity">${t('common.confirm')}</button>
          </div>
        </div>
      `;
      document.body.appendChild(dialog);

      // Prevent click events from bubbling to the container
      dialog.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = e.target.getAttribute('data-action');
        if (action === 'ok') doResolve(true);
        else if (action === 'cancel' || action === 'dismiss') doResolve(false);
      });
    });
  };

  // ── Helper: re-render only the table + pagination (no full reload) ──
  // Used after mutations like cancel so the UI reflects the new status
  // immediately, without forcing the user to manually refresh the page.
  const refreshRequestTable = () => {
    const tbody = container.querySelector('#requests-tbody');
    const paginationWrap = container.querySelector('#pagination-wrapper');
    if (!tbody) return;

    // Re-derive the visible rows from the current data set and inject them.
    // Event handlers are bound via delegation on `container` (see below),
    // so replacing the tbody HTML here keeps everything working.
    const visibleRequests = currentStatus === 'cancelled'
      ? currentRequestsData.requests.filter(r => isEmployeeCancelled(r))
      : currentRequestsData.requests;

    tbody.innerHTML = renderTableRows(visibleRequests);

    if (paginationWrap) {
      paginationWrap.innerHTML = renderPaginationHTML(visibleRequests, currentRequestsData.pagination);
    }
  };

  // ── Subscribe to DataService events for cross-component sync ──
  // When another component (e.g. admin dashboard) mutates data,
  // this listener re-renders the employee table automatically.
  const unsubscribeFromDataService = dataService.on('requests-updated', (data) => {
    // Only update if this component is still mounted
    if (!container.querySelector('#requests-tbody')) return;
    currentRequestsData = data;
    const openReqEl = container.querySelector('#stat-open-requests');
    if (openReqEl) openReqEl.textContent = data.stats?.open_requests ?? 0;
    refreshRequestTable();
  });

  // Cleanup subscription when the route changes (component unmounts)
  // Vanilla JS SPA doesn't have a built-in unmount hook, so we hook
  // into the hashchange event to unsubscribe before the next render.
  const cleanupDataService = () => unsubscribeFromDataService();
  window.addEventListener('hashchange', cleanupDataService, { once: true });

  // ── New Request Button ────────────────────────────────────────
  container.querySelector('#btn-new-request')?.addEventListener('click', () => {
    navigate(getRequestBase() + '/new-request');
  });

  // ── On-Behalf: Modal open/close ───────────────────────────────
  const onBehalfModal = container.querySelector('#on-behalf-modal');
  const onBehalfPreview = container.querySelector('#on-behalf-employee-preview');
  const onBehalfNotFound = container.querySelector('#on-behalf-not-found');
  const onBehalfConfirmBtn = container.querySelector('#on-behalf-confirm-btn');
  const onBehalfEmpInput = container.querySelector('#on-behalf-emp-id-input');
  let selectedOnBehalfEmployee = null;

  const openOnBehalfModal = () => {
    if (!onBehalfModal) return;
    // reset state
    if (onBehalfEmpInput) onBehalfEmpInput.value = '';
    onBehalfPreview?.classList.add('hidden');
    onBehalfNotFound?.classList.add('hidden');
    if (onBehalfConfirmBtn) onBehalfConfirmBtn.disabled = true;
    selectedOnBehalfEmployee = null;
    onBehalfModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => onBehalfEmpInput?.focus(), 100);
  };

  const closeOnBehalfModal = () => {
    onBehalfModal?.classList.add('hidden');
    document.body.style.overflow = '';
  };

  container.querySelector('#btn-new-request-on-behalf')?.addEventListener('click', openOnBehalfModal);
  container.querySelector('#on-behalf-modal-close')?.addEventListener('click', closeOnBehalfModal);
  container.querySelector('#on-behalf-modal-backdrop')?.addEventListener('click', closeOnBehalfModal);
  container.querySelector('#on-behalf-cancel-btn')?.addEventListener('click', closeOnBehalfModal);

  // ── On-Behalf: Employee Search ────────────────────────────────
  const searchOnBehalfEmployee = async () => {
    const rawInput = onBehalfEmpInput?.value?.trim() || '';
    if (!rawInput) return;

    // Show loading state on the search button
    const searchBtn = container.querySelector('#on-behalf-search-btn');
    if (searchBtn) searchBtn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">sync</span>';

    onBehalfPreview?.classList.add('hidden');
    onBehalfNotFound?.classList.add('hidden');
    if (onBehalfConfirmBtn) onBehalfConfirmBtn.disabled = true;
    selectedOnBehalfEmployee = null;

    try {
      const res = await getHrmsEmployee(rawInput);
      const emp = res?.data?.employee;

      if (emp) {
        selectedOnBehalfEmployee = {
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
        // Populate preview
        const nameEl = container.querySelector('#on-behalf-preview-name');
        const empIdEl = container.querySelector('#on-behalf-preview-empid');
        const posEl = container.querySelector('#on-behalf-preview-position');
        const deptEl = container.querySelector('#on-behalf-preview-dept');
        const compEl = container.querySelector('#on-behalf-preview-company');
        if (nameEl) nameEl.textContent = emp.EmpName || '-';
        if (empIdEl) empIdEl.textContent = emp.ID_Emp || rawInput;
        if (posEl) posEl.textContent = emp.Position || '-';
        if (deptEl) deptEl.textContent = emp.Department || '-';
        if (compEl) compEl.textContent = emp.CompanyName || '-';
        onBehalfPreview?.classList.remove('hidden');
        if (onBehalfConfirmBtn) onBehalfConfirmBtn.disabled = false;
      } else {
        onBehalfNotFound?.classList.remove('hidden');
      }
    } catch (err) {
      console.error('[OnBehalf] Search error:', err);
      onBehalfNotFound?.classList.remove('hidden');
    } finally {
      if (searchBtn) searchBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">search</span>';
    }
  };

  container.querySelector('#on-behalf-search-btn')?.addEventListener('click', searchOnBehalfEmployee);
  onBehalfEmpInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchOnBehalfEmployee();
  });

  // ── On-Behalf: Confirm → Navigate to new-request ─────────────
  container.querySelector('#on-behalf-confirm-btn')?.addEventListener('click', () => {
    if (!selectedOnBehalfEmployee) return;
    const empId = selectedOnBehalfEmployee.emp_id || selectedOnBehalfEmployee.empCode || '';
    closeOnBehalfModal();
    const user = getCurrentUser();
    const isAdmin = user && user.role !== 'employee';
    const basePath = isAdmin ? '/admin' : '/employee';
    navigate(`${basePath}/new-request?on_behalf_of=${encodeURIComponent(empId)}`);
  });

  // ── Tracker / Status Modal ────────────────────────────────────
  const trackerModal = container.querySelector('#tracker-modal');
  const trackerModalBody = container.querySelector('#tracker-modal-body');

  const openTrackerModal = (req) => {
    if (!req) return;

    const reqId = req.id || req.request_code;
    const rawReqs = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
    const raw = rawReqs.find(r => r.id === reqId) || {};

    // Normalize field names and merge stored details (ETA submit date, etc.)
    req = enrichRequestDownloadAccess({
      ...req,
      ...raw,
      id: reqId,
      type: req.type || raw.type || req.purpose || '',
      date: req.date || req.created_at || raw.date || '',
      status: req.status || raw.status,
      statusLabel: req.statusLabel || req.status_label || raw.statusLabel || req.status,
      acknowledged_by: req.acknowledged_by || raw.acknowledged_by || '',
      eta_date: req.eta_date || raw.eta_date || '',
      eta_submitted_at: req.eta_submitted_at || raw.eta_submitted_at || '',
      cert_ready: req.cert_ready ?? raw.cert_ready ?? false,
      cert_issued_at: req.cert_issued_at || raw.cert_issued_at || '',
      cert_download_until: req.cert_download_until || raw.cert_download_until || '',
      attachments: (() => { try { return JSON.parse(req.supporting_docs || '[]'); } catch { return req.attachments || raw.attachments || []; } })(),
    });

    const steps = buildStepsForRequest(req);
    const ETA_WORKING_DAYS = 3;
    let etaDisplay = '';
    let isCustomEta = false;

    const months = t('month.short');

    // ETA: priority 1) req.eta_date from API, 2) activeTracker, 3) default 3 working days
    const etaSource = req.eta_date || (req.id === activeTracker?.id ? activeTracker.eta_date : '') || '';
    if (etaSource) {
      const parts = etaSource.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        etaDisplay = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
        isCustomEta = true;
      }
    }
    if (!etaDisplay) {
      const d = addWorkingDays(new Date(), ETA_WORKING_DAYS);
      etaDisplay = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
    }

    const hasEta = !!req.eta_date;
    const modalStatus = hasEta ? 'in-review-eta' : req.status;
    const modalLabelMap = { 'submitted': t('status.submitted'), 'in-review': t('status.inReview'), 'approved': t('status.approved'), 'rejected': t('status.rejected'), 'cancelled': t('status.cancelled') };
    const modalStatusLabel = req.status === 'in-review' && hasEta ? t('status.inProgress') : (isEmployeeCancelled(req) ? t('status.cancelled') : (modalLabelMap[req.status] || req.statusLabel || req.status));
    const statusColors = {
      'submitted':     'bg-primary/10 text-primary',
      'in-review':     'bg-[#fef3c7] text-[#92400e]',
      'in-review-eta': 'bg-[#dce1ff] text-primary',
      'approved':      'bg-[#dcfce7] text-[#166534]',
      'rejected':      'bg-[#fee2e2] text-[#991b1b]',
      'cancelled':     'bg-surface-container-highest text-outline',
      'draft':         'bg-surface-container-highest text-on-surface-variant',
    };

    const progressSteps = steps.filter(s => s.completed).length;
    const progressWidth = `${Math.round((progressSteps / steps.length) * 100)}%`;

    trackerModalBody.innerHTML = `
      <!-- Request Meta -->
      <div class="bg-surface-container rounded-xl px-5 py-4 mb-5">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-label-sm font-bold text-primary uppercase tracking-widest">${req.type || t('employeeReq.typeFallback')}</span>
          <span class="px-3 py-1 rounded-full text-label-sm font-bold ${statusColors[modalStatus] || statusColors.draft}">${modalStatusLabel}</span>
        </div>
        <p class="text-headline-md font-bold text-on-surface">${req.id || req.request_code}</p>
        <p class="text-label-sm text-outline mt-1">${t('employeeReq.sentDate')} ${req.date || '-'}</p>
        ${req.status !== 'rejected' && !isEmployeeCancelled(req) ? `
        <div class="mt-3 flex items-center gap-2 text-label-sm text-primary font-bold">
          <span class="material-symbols-outlined text-[16px]">schedule</span>
          ${t('employeeReq.etaLabel')} <span class="font-bold">${etaDisplay}</span>
          ${isCustomEta ? `<span class="text-primary font-normal">${t('employeeReq.etaCustom')}</span>` : `<span class="text-outline font-normal">${t('employeeReq.etaDefault')}</span>`}
        </div>
        ` : req.status === 'rejected' ? `
        <div class="mt-3 bg-error-container/40 border border-error/20 rounded-xl p-4">
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-error shrink-0">cancel</span>
            <div>
              <p class="text-label-md font-bold text-on-surface mb-1">${t('status.rejected')}</p>
              <p class="text-body-md text-on-surface-variant leading-relaxed">${req.rejection_reason || '-'}</p>
              ${req.rejected_by ? `<p class="text-label-sm text-outline mt-2">โดย: ${req.rejected_by}</p>` : ''}
            </div>
          </div>
        </div>` : ''}
      </div>

      <!-- Attachments -->
      ${(req.attachments && req.attachments.length > 0) ? `
      <div class="mb-5">
        <p class="text-label-sm font-bold text-on-surface-variant mb-2 flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px]">attach_file</span>
          ${t('common.attachments')}
        </p>
        <div class="flex flex-col gap-2">
          ${req.attachments.map(a => `
            <a href="#" data-attach-key="${a.key}" class="flex items-center gap-3 px-3 py-2 bg-surface-container rounded-lg hover:bg-surface-container-high transition-colors text-on-surface">
              <span class="material-symbols-outlined text-outline text-lg">description</span>
              <span class="text-label-sm font-medium flex-1 truncate">${a.name}</span>
              <span class="material-symbols-outlined text-outline text-lg">download</span>
            </a>
          `).join('')}
        </div>
      </div>` : ''}

      <!-- Delivery Status (for physical documents) -->
      ${(() => {
        const deliveryValue = req.delivery_value || '';
        const hasPhysical = deliveryValue.includes('physical');
        const physicalDelivered = req.physical_delivered || false;
        if (!hasPhysical) return '';
        return `
        <div class="mb-5 bg-surface-container rounded-xl px-5 py-4 border border-outline-variant/40">
          <p class="text-label-xs font-bold text-outline uppercase tracking-widest mb-3">${t('dashboard.deliveryStatus')}</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <p class="text-label-sm text-on-surface-variant">${t('dashboard.deliveryStatus')}</p>
              <p class="text-label-md font-bold ${physicalDelivered ? 'text-green-700' : 'text-amber-700'}">${physicalDelivered ? t('dashboard.deliverySent') : t('dashboard.deliveryPending')}</p>
            </div>
            ${req.pickup_location ? `
            <div>
              <p class="text-label-sm text-on-surface-variant">${t('newReq.labelPickup')}</p>
              <p class="text-label-md font-bold text-on-surface">${req.pickup_location}</p>
            </div>` : ''}
          </div>
        </div>`;
      })()}

      <!-- Progress Bar -->
      <div class="relative h-1.5 bg-surface-container-highest rounded-full mb-6">
        <div class="h-full bg-primary rounded-full transition-all duration-700" style="width: ${progressWidth}"></div>
      </div>

      <!-- Steps list -->
      <div class="flex flex-col gap-3 mb-6">
        ${steps.map((step, i) => `
          <div class="flex items-start gap-4 ${!step.completed ? 'opacity-40' : ''}">
            <div class="flex flex-col items-center">
              <div class="w-9 h-9 rounded-full ${step.completed ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-highest text-on-surface-variant'} flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-[18px]">${step.icon}</span>
              </div>
              ${i < steps.length - 1 ? `<div class="w-0.5 h-6 ${step.completed ? 'bg-primary' : 'bg-outline-variant'} mt-1"></div>` : ''}
            </div>
            <div class="pt-1.5">
              <p class="text-label-md font-bold text-on-surface">${step.label}</p>
              <p class="text-label-sm ${step.active ? 'text-primary font-bold' : 'text-outline'}">${step.date}</p>
              ${step.subdate ? `<p class="text-label-sm text-outline">${step.subdate}</p>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      ${req.cert_ready ? (() => {
        const downloadActive = isDownloadWindowOpen(req);
        const untilDisplay = req.cert_download_until ? formatIsoDateDisplay(req.cert_download_until) : '';
        if (downloadActive) {
          return `
      <div class="mb-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-label-sm text-on-surface-variant">
        <span class="material-symbols-outlined text-[16px] align-middle text-primary mr-1">schedule</span>
        ${t('employeeReq.downloadUntilLabel')} <span class="font-bold text-primary">${untilDisplay}</span>
      </div>`;
        }
        return `
      <div class="mb-3 rounded-xl border border-error/20 bg-error-container/30 px-4 py-3 text-label-sm text-on-surface-variant">
        <span class="material-symbols-outlined text-[16px] align-middle text-error mr-1">event_busy</span>
        ${t('employeeReq.downloadExpired', { date: untilDisplay })}
      </div>`;
      })() : ''}
      <button id="tracker-modal-close-btn" class="w-full py-3 bg-secondary-container text-primary font-bold rounded-xl hover:opacity-80 transition-opacity">
        ${t('common.close')}
      </button>
    `;

    // bind close button inside modal body
    trackerModalBody.querySelector('#tracker-modal-close-btn')?.addEventListener('click', closeTrackerModal);

    // bind attachment links inside modal body
    trackerModalBody.querySelectorAll('[data-attach-key]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        window.open(`/api/file/${encodeURIComponent(el.getAttribute('data-attach-key'))}`, '_blank');
      });
    });

    trackerModal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

  const closeTrackerModal = () => {
    trackerModal?.classList.add('hidden');
    document.body.style.overflow = '';
  };

  container.querySelector('#tracker-modal-close')?.addEventListener('click', closeTrackerModal);
  container.querySelector('#tracker-modal-backdrop')?.addEventListener('click', closeTrackerModal);

  // ── Helper: Re-render page with new params ─────────────────────
  const reloadPage = async (page) => {
    sessionStorage.setItem('requests-page', String(page));
    sessionStorage.setItem('requests-search', currentSearch);
    sessionStorage.setItem('requests-status', currentStatus);
    window.dispatchEvent(new Event('hashchange'));
  };

  // ── Row Action Buttons (event delegation) ───────────────────────
  // Using delegation on the container so that re-rendering the table
  // body (e.g. after cancel) keeps the handlers attached.
  const findReq = (id) => currentRequestsData.requests.find(r => r.request_code === id || String(r.id) === String(id));

  container.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.btn-view');
    const downloadBtn = e.target.closest('.btn-download');
    const cancelBtn = e.target.closest('.btn-cancel');
    const resubmitBtn = e.target.closest('.btn-resubmit');
    const row = e.target.closest('.request-row');
    const pageBtn = e.target.closest('.btn-page');

    if (viewBtn) {
      e.stopPropagation();
      const id = viewBtn.getAttribute('data-id');
      openTrackerModal(findReq(id));
      return;
    }

    if (downloadBtn) {
      e.stopPropagation();
      const id = downloadBtn.getAttribute('data-id');
      const req = enrichRequestDownloadAccess(
        currentRequestsData.requests.find(r => r.request_code === id || String(r.id) === String(id)) || {}
      );
      handleDownload(downloadBtn, id, req);
      return;
    }

    if (cancelBtn) {
      e.stopPropagation();
      handleCancel(cancelBtn.getAttribute('data-id'));
      return;
    }

    if (resubmitBtn) {
      e.stopPropagation();
      const id = resubmitBtn.getAttribute('data-id');
      navigate(getRequestBase() + '/new-request?resubmit=' + encodeURIComponent(id));
      return;
    }

    if (pageBtn) {
      const page = parseInt(pageBtn.getAttribute('data-page'));
      if (page > 0 && page <= currentRequestsData.pagination.totalPages) {
        reloadPage(page);
      }
      return;
    }

    if (row && !e.target.closest('button')) {
      const id = row.getAttribute('data-id');
      openTrackerModal(findReq(id));
    }
  });
  // ── handleDownload: download cert or attachments for a request ──
  const handleDownload = async (btn, id, req) => {
    // If cert is ready, show the PDF certificate
    if (req && req.cert_ready) {
      if (!isDownloadWindowOpen(req)) {
        showToast(t('employeeReq.downloadExpired', { date: formatIsoDateDisplay(req.cert_download_until) }), 'error');
        return;
      }
      const user = getCurrentUser();
      const rawReqs = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
      const raw = enrichRequestDownloadAccess(rawReqs.find(r => r.id === id) || req);
      const data = buildCertDataFromRequest(raw, user);
      await triggerPrintPdf(data, req.id || req.request_code);
      return;
    }
    const row = btn.closest('tr');
    try {
      const attachments = JSON.parse(row?.getAttribute('data-attachments') || '[]');
      if (attachments.length > 0) {
        for (const att of attachments) {
          window.open(`/api/file/${encodeURIComponent(att.key)}`, '_blank');
        }
      } else {
        showToast(t('employeeReq.downloadSuccess', { id }), 'download_done');
      }
    } catch (err) {
      showToast(t('employeeReq.downloadError'), 'error');
    }
  };

  // ── handleCancel: employee cancels a request ───────────────────
  let isCancelling = false;  // Guard to prevent multiple concurrent cancel requests
  const handleCancel = async (id) => {
    if (isCancelling) return;  // Prevent double-click
    isCancelling = true;

    // Use a custom confirm dialog instead of browser confirm() for reliability
    const confirmed = await showConfirmDialog(t('employeeReq.cancelConfirm', { id }));
    if (!confirmed) {
      isCancelling = false;
      return;
    }
    closeTrackerModal();
    showLoading(t('common.loading'));

    try {
      await dataService.cancelRequest(id);
      // dataService emits 'requests-updated' → our subscription refreshes the table
      hideLoading();
      showToast(t('employeeReq.cancelSuccess', { id }), 'cancel');
    } catch (err) {
      console.error('[Cancel] Failed:', err);
      // dataService has already rolled back the optimistic update
      // and emitted 'requests-updated' with the previous data
      hideLoading();
      showToast(t('employeeReq.cancelFailed') + ' — ' + (err.message || ''), 'error');
    } finally {
      isCancelling = false;  // Reset guard
    }
  };

  // ── Resubmit (handled via delegation) ──────────────────────────
  // Note: resubmit navigation is done inside the delegated click handler
  // above, so no extra binding is needed here.

  // ── Row click → open status modal ─────────────────────────────
  // Also handled by the delegated click handler above.

  // ── Search & Filter ────────────────────────────────────────────
  const searchInput = container.querySelector('#filter-search');
  const statusFilter = container.querySelector('#filter-status');

  const applyFilter = () => {
    const query = searchInput?.value.toLowerCase().trim() || '';
    const status = statusFilter?.value || '';
    currentSearch = query;
    currentStatus = status;
    reloadPage(1);
  };

  searchInput?.addEventListener('input', applyFilter);
  statusFilter?.addEventListener('change', applyFilter);
  container.querySelector('#filter-period')?.addEventListener('change', () => {
    showToast(t('employeeReq.periodUpdated'), 'event');
  });

  // ── Clear Filter ───────────────────────────────────────────────
  container.querySelector('#btn-clear-filter')?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = '';
    container.querySelector('#filter-period').value = '';
    currentSearch = '';
    currentStatus = '';
    reloadPage(1);
    showToast(t('employeeReq.filterCleared'), 'filter_list_off');
  });

  // ── Keyboard: Escape to close modals ──────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeTrackerModal();
      closeRejectionModal();
      closeOnBehalfModal();
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  // Return cleanup
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
}
