/**
 * Admin: Dashboard Page
 * Built from hr_admin_2/screen.png
 */
import { navigate } from '../router.js';
import { getCurrentUser } from '../mock-data.js';
import { getEmployeeRequests, updateRequest, cancelRequest } from '../lib/api.js';
import { openEditableCertificate } from '../lib/templates.js';
import { t } from '../lib/i18n.js';
import { loadAvatarForElement } from '../lib/avatar-helper.js';
import { dataService } from '../lib/data-service.js';

const MONTHS_SHORT = t('month.short');

// Module-level cache of enriched pending data — used by detail modal and avatar loader
let _lastPendingData = [];

/**
 * Backend stores employee-cancelled requests as status='rejected' with the flag
 * request_data.cancelled_by_employee = true (because the requests.status CHECK
 * constraint disallows 'cancelled'). The /requests endpoint also surfaces the
 * flag at the top level for easy client access. This helper checks both
 * so HR UI can render employee-cancelled items distinctly from HR-rejected.
 */
function isEmployeeCancelled(req) {
  if (!req) return false;
  if (req.status === 'cancelled') return true;
  if (req.cancelled_by_employee === true) return true;
  const meta = req.request_data || {};
  return meta.cancelled_by_employee === true;
}

// Normalize acknowledged_by (could be string or {name,email} object)
function normalizeAcknowledgedBy(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return val.name || val.email || '';
  return String(val);
}

function renderRequesterAvatar(req) {
  const empId = req.emp_id;
  const initials = req.initials || '??';
  if (empId) {
    return `<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-avatar-emp-id="${empId}" alt="" class="w-8 h-8 rounded-full object-cover border border-outline-variant shrink-0" onerror="this.onerror=null; this.outerHTML=\`<div class='w-8 h-8 rounded-full bg-primary-fixed text-primary flex items-center justify-center text-[10px] font-bold shrink-0'>${initials}</div>\`;" />`;
  }
  return `<div class="w-8 h-8 rounded-full bg-primary-fixed text-primary flex items-center justify-center text-[10px] font-bold shrink-0">${initials}</div>`;
}

function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return dateStr;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function getDashboardFilterStatus() {
  const v = sessionStorage.getItem('dashboard-pending-filter');
  return v === null ? 'submitted' : v;
}

function filterDashboardPending(pending, filterStatus) {
  if (!filterStatus) return pending;
  if (filterStatus === 'submitted') {
    return pending.filter(r => r.status === 'submitted' || r.status === 'in-review');
  }
  if (filterStatus === 'today') {
    const today = new Date();
    const todayLabel = `${today.getDate()} ${t('month.short')[today.getMonth()]} ${today.getFullYear() + 543}`;
    return pending.filter(r => (r.date || '').includes(todayLabel));
  }
  return pending.filter(r => r.status === filterStatus && !isEmployeeCancelled(r));
}

function escapeCsvCell(value) {
  const str = value == null ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function formatAttachmentNames(attachments = []) {
  if (!attachments.length) return '';
  return attachments.map(f => f.name || f.key || '').filter(Boolean).join('; ');
}

function buildDashboardCsvHeaders() {
  return [
    t('dashboard.csvColId'),
    t('dashboard.csvColName'),
    t('dashboard.csvColEmpId'),
    t('dashboard.csvColEmail'),
    t('dashboard.csvColPhone'),
    t('dashboard.csvColDept'),
    t('dashboard.csvColPosition'),
    t('dashboard.csvColCompany'),
    t('dashboard.csvColDocType'),
    t('dashboard.csvColPurpose'),
    t('dashboard.csvColLanguage'),
    t('dashboard.csvColSalary'),
    t('dashboard.csvColDelivery'),
    t('dashboard.csvColPickup'),
    t('dashboard.csvColStatus'),
    t('dashboard.csvColRequestDate'),
    t('dashboard.csvColEta'),
    t('dashboard.csvColHrSelected'),
    t('dashboard.csvColHrAck'),
    t('dashboard.csvColAttachments'),
    t('dashboard.csvColNotes'),
    t('dashboard.csvColCertNo'),
    t('dashboard.csvColCertDate'),
    t('dashboard.csvColHrbpIssued'),
    t('dashboard.csvColSigner'),
    t('dashboard.csvColIssuedBy'),
    t('dashboard.csvColRejectReason'),
  ];
}

function buildDashboardCsvRow(item, raw = {}, user = {}) {
  const snap = raw.cert_issue_snapshot || null;
  const docType = raw.type || item.type || '';
  const pickup = raw.pickup_location || '';
  const issuedHrbp = snap?.hr_officer_name || raw.hr_officer_name || '';
  const signerName = snap?.hr_signer_name || raw.hr_signer_name || '';
  const signerPos = snap?.hr_signer_position || raw.hr_signer_position || '';
  const signer = signerName ? `${signerName}${signerPos ? ` (${signerPos})` : ''}` : '';

  return [
    item.id || raw.id || '',
    item.name || user.full_name || '',
    item.emp_id || user.emp_id || user.empCode || '',
    raw.user_email || item.user_email || user.email || '',
    item.phone || user.phone || raw.phone || '',
    item.department || user.department || '',
    user.position || '',
    user.company_name || '',
    docType,
    raw.purpose || item.purpose || '',
    raw.language || item.language || '',
    raw.salary || item.salary || '',
    raw.delivery || item.delivery || '',
    pickup,
    item.statusLabel || raw.statusLabel || raw.status_label || item.status || '',
    item.date || raw.date || raw.created_at || '',
    (item.eta_date || raw.eta_date) ? formatThaiDate(item.eta_date || raw.eta_date) : '',
    raw.hr_officer?.name || item.hr_officer || '',
    normalizeAcknowledgedBy(raw.acknowledged_by || item.acknowledged_by || ''),
    formatAttachmentNames(raw.attachments || item.attachments || []),
    raw.notes || '',
    snap?.cert_number || raw.cert_number || '',
    snap?.cert_issued_date || raw.cert_issued_date || '',
    issuedHrbp,
    signer,
    snap?.issued_by_name || '',
    raw.rejection_reason || '',
  ];
}

function buildDashboardCsv(pendingItems) {
  const rawReqs = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
  const users = JSON.parse(localStorage.getItem('hrbp_mock_users') || '[]');
  const rawMap = {};
  rawReqs.forEach(r => { if (r.id) rawMap[r.id] = r; });
  const userMap = {};
  users.forEach(u => { if (u.email) userMap[u.email.toLowerCase()] = u; });

  const headers = buildDashboardCsvHeaders();
  const rows = pendingItems.map(item => {
    const raw = rawMap[item.id] || {};
    const user = userMap[(raw.user_email || item.user_email || '').toLowerCase()] || {};
    return buildDashboardCsvRow(item, raw, user);
  });

  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map(r => r.map(escapeCsvCell).join(',')),
  ];
  return '\uFEFF' + lines.join('\n');
}

function computeDashboardData(data) {
  const requests = data?.requests || [];

  const today = new Date();
  const todayLabel = `${today.getDate()} ${t('month.short')[today.getMonth()]} ${today.getFullYear() + 543}`;
  const completedToday = requests.filter(r => {
    const d = r.created_at || '';
    return d.includes(todayLabel);
  }).length;

  const pendingReqs = requests.filter(r => r.status === 'submitted' || r.status === 'in-review');
  const approved = requests.filter(r => r.status === 'approved');
  // Only count HR-rejected items here. Employee-cancelled ones still carry
  // status='rejected' but must be excluded so the "ปฏิเสธ" KPI isn't polluted.
  const rejected = requests.filter(r => r.status === 'rejected' && !isEmployeeCancelled(r));
  const cancelled = requests.filter(r => isEmployeeCancelled(r));

  const kpis = [
    { label: `${t('dashboard.kpiAll')}`, value: String(requests.length), icon: 'description', trend: '', color: 'primary', filterValue: '' },
    { label: `${t('dashboard.kpiPending')}`, value: String(pendingReqs.length), icon: 'assignment_ind', sublabel: `${t('dashboard.subPending')}`, color: 'secondary', filterValue: 'submitted' },
    { label: `${t('dashboard.kpiApproved')}`, value: String(approved.length), icon: 'check_circle', sublabel: `${t('dashboard.subApproved')}`, color: 'success', filterValue: 'approved' },
    { label: `${t('dashboard.kpiRejected')}`, value: String(rejected.length), icon: 'cancel', sublabel: '', color: 'error', filterValue: 'rejected' },
    { label: `${t('dashboard.kpiToday')}`, value: String(completedToday), icon: 'today', sublabel: `${t('dashboard.subToday')}`, color: 'primary', filterValue: 'today' },
  ];

  // Monthly chart from real data — 5 categories
  const months = t('month.short');
  const chartData = months.map(() => ({ total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 }));
  requests.forEach(r => {
    const d = r.created_at || '';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return;
    const mIdx = dateObj.getMonth();
    chartData[mIdx].total++;
    if (r.status === 'submitted' || r.status === 'in-review') chartData[mIdx].pending++;
    else if (r.status === 'approved') chartData[mIdx].approved++;
    else if (r.status === 'rejected' && !isEmployeeCancelled(r)) chartData[mIdx].rejected++;
    else if (isEmployeeCancelled(r)) chartData[mIdx].cancelled++;
  });
  const chart = {
    months,
    total: chartData.map(d => d.total),
    pending: chartData.map(d => d.pending),
    approved: chartData.map(d => d.approved),
    rejected: chartData.map(d => d.rejected),
    cancelled: chartData.map(d => d.cancelled),
  };

  // Enrich pending requests with user info from users DB
  const users = JSON.parse(localStorage.getItem('hrbp_mock_users') || '[]');
  const userMap = {};
  users.forEach(u => { if (u.email) userMap[u.email.toLowerCase()] = u; });
  // Read raw request details (extra fields not in mapped API response)
  const rawReqs = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
  const rawMap = {};
  rawReqs.forEach(r => { if (r.id) rawMap[r.id] = r; });
  // Also include approved + rejected + cancelled requests for the table
  const allTableReqs = pendingReqs.concat(approved.map(r => {
    return {
      ...r,
      initials: ((r.user_email || '??').charAt(0) || '').toUpperCase(),
      name: r.user_email || t('common.anonymous'),
      phone: '',
      type: r.purpose || '',
      purpose: r.purpose || rawMap[r.id || r.request_code]?.purpose || '',
      doc_type: r.doc_type || rawMap[r.id || r.request_code]?.doc_type || '',
      language: r.language || rawMap[r.id || r.request_code]?.language || '',
      salary: r.salary || rawMap[r.id || r.request_code]?.salary || '',
      delivery: r.delivery || rawMap[r.id || r.request_code]?.delivery || '',
      statusLabel: r.status_label || r.statusLabel || t('status.approved'),
      eta_date: r.eta_date || rawMap[r.id || r.request_code]?.eta_date || '',
      date: r.date || r.created_at || '',
      attachments: r.attachments || rawMap[r.id || r.request_code]?.attachments || [],
      hr_officer: r.hr_officer?.name || rawMap[r.id || r.request_code]?.hr_officer?.name || '',
      cert_ready: r.cert_ready || false,
    };
  })).concat(cancelled.map(r => {
    return {
      ...r,
      initials: ((r.user_email || '??').charAt(0) || '').toUpperCase(),
      name: r.user_email || t('common.anonymous'),
      phone: '',
      type: r.purpose || '',
      purpose: r.purpose || rawMap[r.id || r.request_code]?.purpose || '',
      doc_type: r.doc_type || rawMap[r.id || r.request_code]?.doc_type || '',
      language: r.language || rawMap[r.id || r.request_code]?.language || '',
      salary: r.salary || rawMap[r.id || r.request_code]?.salary || '',
      delivery: r.delivery || rawMap[r.id || r.request_code]?.delivery || '',
      statusLabel: r.status_label || r.statusLabel || t('status.approved'),
      eta_date: r.eta_date || rawMap[r.id || r.request_code]?.eta_date || '',
      date: r.date || r.created_at || '',
      attachments: r.attachments || rawMap[r.id || r.request_code]?.attachments || [],
      hr_officer: r.hr_officer?.name || rawMap[r.id || r.request_code]?.hr_officer?.name || '',
      acknowledged_by: rawMap[r.id || r.request_code]?.acknowledged_by || null,
      cert_ready: r.cert_ready || false,
    };
  })).concat(rejected.map(r => {
    // Defensive: a cancelled-by-employee request could land here if its flag
    // was missing — still prefer the "ยกเลิกโดยพนักงาน" label so HR sees truth.
    const employeeCancelled = isEmployeeCancelled(r);
    return {
      ...r,
      initials: ((r.user_email || '??').charAt(0) || '').toUpperCase(),
      name: r.user_email || t('common.anonymous'),
      phone: '',
      type: r.purpose || '',
      purpose: r.purpose || rawMap[r.id || r.request_code]?.purpose || '',
      doc_type: r.doc_type || rawMap[r.id || r.request_code]?.doc_type || '',
      language: r.language || rawMap[r.id || r.request_code]?.language || '',
      salary: r.salary || rawMap[r.id || r.request_code]?.salary || '',
      delivery: r.delivery || rawMap[r.id || r.request_code]?.delivery || '',
      statusLabel: employeeCancelled ? t('status.cancelled') : (r.status_label || r.statusLabel || t('status.rejected')),
      eta_date: r.eta_date || '',
      date: r.date || r.created_at || '',
      attachments: r.attachments || rawMap[r.id || r.request_code]?.attachments || [],
      hr_officer: r.hr_officer?.name || rawMap[r.id || r.request_code]?.hr_officer?.name || '',
      acknowledged_by: r.acknowledged_by || rawMap[r.id || r.request_code]?.acknowledged_by || null,
      cert_ready: r.cert_ready || false,
    };
  }));
  const pending = allTableReqs.map(r => {
    const u = userMap[(r.user_email || '').toLowerCase()] || {};
    const raw = rawMap[r.id || r.request_code] || {};
    const eta = r.eta_date || raw.eta_date || '';
    const isEtaSet = !!eta;
    const statusLabelMap = { 'submitted': t('status.submitted'), 'in-review': t('status.inReview'), 'approved': t('status.approved'), 'rejected': t('status.rejected'), 'cancelled': t('status.cancelled') };
    const label = r.status === 'in-review' && isEtaSet ? t('status.inProgress') : (isEmployeeCancelled(r) ? t('status.cancelled') : (statusLabelMap[r.status] || r.status_label || r.statusLabel || r.status));
    const hrInfo = r.hr_officer || raw.hr_officer || {};
    const hrOfficerName = hrInfo.name || '';
    return {
      id: r.id || r.request_code,
      emp_id: u.emp_id || u.empCode || r.emp_id || '',
      initials: (u.full_name || (r.user_email || '??')).substring(0, 2).toUpperCase(),
      name: u.full_name || r.user_name || r.user_email || t('common.anonymous'),
      full_name: u.full_name || r.user_name || '',
      phone: u.phone || r.phone || raw.phone || '',
      type: r.type || r.purpose || '',
      purpose: r.purpose || raw.purpose || '',
      doc_type: r.doc_type || raw.doc_type || '',
      language: r.language || raw.language || '',
      salary: r.salary || raw.salary || '',
      delivery: r.delivery || raw.delivery || '',
      delivery_value: r.delivery_value || raw.delivery_value || '',
      pickup_location: r.pickup_location || raw.pickup_location || '',
      physical_delivered: r.physical_delivered || raw.physical_delivered || false,
      notes: r.notes || raw.notes || '',
      department: u.department || r.user_department || r.department || '',
      company_name: u.company_name || raw.company_name || r.company_name || '',
      position: u.position || raw.position || r.position || '',
      start_date: u.start_date || r.start_date || '',
      status: r.status,
      statusLabel: label,
      eta_date: eta,
      date: r.date || r.created_at || '',
      attachments: r.attachments || raw.attachments || [],
      hr_officer: hrOfficerName,
      acknowledged_by: r.acknowledged_by || raw.acknowledged_by || null,
      cert_ready: r.cert_ready || raw.cert_ready || false,
      cancelled_by_employee: isEmployeeCancelled(r),
      request_data: r.request_data || raw.request_data || {}
    };
  });

  return { kpis, pending, chart };
}

export function renderAdminDashboard(data) {
  const { kpis, pending, chart } = computeDashboardData(data);
  _lastPendingData = pending;  // cache for detail modal and avatar lookup
  const chartPeriod = sessionStorage.getItem('dashboard-chart-period') || '6m';
  const slice = chartPeriod === '6m' ? -6 : undefined;
  const chartMonths = chart.months.slice(slice);
  const chartTotal = chart.total.slice(slice);
  const chartPending = chart.pending.slice(slice);
  const chartApproved = chart.approved.slice(slice);
  const chartRejected = chart.rejected.slice(slice);
  const chartCancelled = chart.cancelled.slice(slice);
  const page = parseInt(sessionStorage.getItem('dashboard-pending-page') || '1');
  const filterStatus = getDashboardFilterStatus();
  const perPage = 5;
  const filtered = filterDashboardPending(pending, filterStatus);
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);
  return `
    <!-- Header Section -->
    <div class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
      <div>
        <h2 class="page-title">${t('dashboard.pageTitle')}</h2>
        <p class="page-subtitle">${t('dashboard.pageSubtitle')}</p>
      </div>
      <div class="flex items-center gap-2 text-label-sm text-outline">
        ${t('dashboard.lastUpdated')} <span class="material-symbols-outlined cursor-pointer hover:text-primary">refresh</span>
      </div>
    </div>

    <!-- KPIs Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      ${kpis.map(kpi => {
        let borderClass = 'border-outline-variant';
        let textClass = 'text-on-surface';
        let subtextClass = 'text-outline';
        let iconBgClass = 'bg-surface-container-high';
        let iconColorClass = 'text-on-surface-variant';
        let valueColor = 'text-primary';

        if (kpi.color === 'success') {
          borderClass = 'border-green-200';
          iconBgClass = 'bg-green-100';
          iconColorClass = 'text-green-700';
          subtextClass = 'text-green-700 font-bold';
        } else if (kpi.color === 'error') {
          borderClass = 'border-red-200';
          iconBgClass = 'bg-red-100';
          iconColorClass = 'text-red-700';
          valueColor = 'text-red-700';
          subtextClass = 'text-red-700 font-bold';
        }

        const isActive = filterStatus === kpi.filterValue;
        return `
          <div class="kpi-card tonal-card p-5 border ${borderClass} relative overflow-hidden group transition-all cursor-pointer ${isActive ? 'ring-2 ring-primary shadow-md' : 'hover:border-primary/50'}" data-filter-value="${kpi.filterValue}">
            <div class="flex justify-between items-start mb-2">
              <div class="w-10 h-10 rounded-lg ${iconBgClass} ${iconColorClass} flex items-center justify-center">
                <span class="material-symbols-outlined text-[20px]">${kpi.icon}</span>
              </div>
              ${kpi.trend ? `<span class="text-[10px] font-bold text-on-surface-variant">${kpi.trend}</span>` : ''}
              ${kpi.sublabel ? `<span class="text-[10px] ${subtextClass}">${kpi.sublabel}</span>` : ''}
            </div>
            <p class="text-label-sm text-on-surface-variant mt-2 mb-1">${kpi.label}</p>
            <h3 class="text-display font-display ${valueColor} leading-none tracking-tight">${kpi.value}</h3>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Pending Requests Table -->
    <div class="tonal-card overflow-hidden border border-outline-variant mb-8">
      <div class="p-6 border-b border-outline-variant flex justify-between items-center flex-wrap gap-3">
        <h3 class="text-headline-md font-bold text-primary">${t('dashboard.tableTitle')}</h3>
        <button id="btn-export-csv" class="text-label-md text-primary font-bold hover:underline">${t('common.export')}</button>
      </div>
      
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-surface-container-low text-label-sm text-on-surface-variant font-bold border-b border-outline-variant">
            <tr>
              <th class="px-6 py-3">${t('dashboard.tableRequester')}</th>
              <th class="px-6 py-3">${t('dashboard.tableDept')}</th>
              <th class="px-6 py-3">${t('dashboard.tableType')}</th>
              <th class="px-6 py-3">${t('dashboard.tableStatus')}</th>
              <th class="px-6 py-3">${t('dashboard.tableDate')}</th>
              <th class="px-6 py-3">${t('dashboard.tableEta')}</th>
              <th class="px-6 py-3">${t('dashboard.tableHr')}</th>
              <th class="px-6 py-3 text-right">${t('dashboard.tableAction')}</th>
            </tr>
          </thead>
          <tbody id="pending-table-body" class="divide-y divide-outline-variant">
            ${pageItems.length > 0 ? pageItems.map(req => {
              let badgeClass = 'bg-surface-container-highest text-on-surface-variant font-bold';
              const isCancelledByEmp = isEmployeeCancelled(req);
              if (isCancelledByEmp) badgeClass = 'bg-surface-container-highest text-outline font-bold';
              else if (req.status === 'submitted') badgeClass = 'bg-primary/10 text-primary font-bold';
              else if (req.status === 'rejected') badgeClass = 'bg-[#fee2e2] text-[#991b1b] font-bold';
              else if (req.status === 'in-review' && !req.eta_date) badgeClass = 'bg-[#fef3c7] text-[#92400e] font-bold';
              else if (req.status === 'in-review' && req.eta_date) badgeClass = 'bg-[#dce1ff] text-primary font-bold';
              else if (req.status === 'approved') badgeClass = 'bg-[#dcfce7] text-[#166534] font-bold';
              else if (req.eta_date) badgeClass = 'bg-[#dce1ff] text-primary font-bold';
              
              return `
                <tr class="hover:bg-surface-container-low transition-colors">
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3 whitespace-nowrap">
                      ${renderRequesterAvatar(req)}
                      <div>
                        <p class="text-label-md font-bold text-on-surface">${req.name}</p>
                        <p class="text-[10px] text-outline">${req.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-label-sm text-on-surface-variant whitespace-nowrap">${req.department}</td>
                  <td class="px-6 py-4 text-label-md text-on-surface whitespace-nowrap">${req.type}</td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2.5 py-1 rounded-md text-[10px] whitespace-nowrap ${badgeClass}">${req.statusLabel}</span>
                  </td>
                  <td class="px-6 py-4 text-label-sm text-on-surface-variant whitespace-nowrap">${req.date}</td>
                  <td class="px-6 py-4 text-label-sm text-on-surface-variant whitespace-nowrap">${formatThaiDate(req.eta_date)}</td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex flex-col gap-1">
                      ${req.hr_officer ? `
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-fixed/20 text-primary rounded text-[10px] font-bold">
                        <span class="material-symbols-outlined text-[12px]">person_pin</span>
                        ${t('dashboard.hrSelected')} ${req.hr_officer}
                      </span>
                      ` : ''}
                      ${req.acknowledged_by ? `
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-[#dcfce7] text-[#166534] rounded text-[10px] font-bold">
                        <span class="material-symbols-outlined text-[12px]">verified</span>
                        ${t('dashboard.hrAcknowledged')} ${req.acknowledged_by}
                      </span>
                      ` : '<span class="text-[10px] text-outline">-</span>'}
                    </div>
                  </td>
                  <td class="px-6 py-4 text-right whitespace-nowrap">
                    <div class="relative dropdown-manage">
                      <button class="btn-dropdown-toggle text-primary hover:bg-primary/10 p-1.5 rounded transition-colors" data-req-id="${req.id}" title="${t('dashboard.tableAction')}">
                        <span class="material-symbols-outlined text-[18px]">more_vert</span>
                      </button>
                      <div class="dropdown-menu hidden absolute right-0 top-full mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 min-w-[180px] overflow-hidden">
                        <button class="btn-view-detail w-full flex items-center gap-3 px-4 py-3 text-label-md text-on-surface hover:bg-surface-container-high transition-colors text-left" data-req-id="${req.id}">
                          <span class="material-symbols-outlined text-[18px] text-outline">visibility</span>
                          ${t('dashboard.actionView')}
                        </button>
                        ${(req.status === 'submitted' || (req.status === 'in-review' && !req.eta_date)) ? `
                        <button class="btn-acknowledge w-full flex items-center gap-3 px-4 py-3 text-label-md text-on-surface hover:bg-surface-container-high transition-colors text-left" data-req-id="${req.id}" data-req-name="${req.name}">
                          <span class="material-symbols-outlined text-[18px] text-outline">handshake</span>
                          ${t('dashboard.actionAck')}
                        </button>
                        ` : ''}
                        ${req.eta_date ? `
                        <button class="btn-edit-eta w-full flex items-center gap-3 px-4 py-3 text-label-md text-on-surface hover:bg-surface-container-high transition-colors text-left" data-req-id="${req.id}" data-req-name="${req.name}">
                          <span class="material-symbols-outlined text-[18px] text-outline">schedule</span>
                          ${t('dashboard.actionEta')}
                        </button>
                        <button class="btn-create-cert w-full flex items-center gap-3 px-4 py-3 text-label-md text-on-surface hover:bg-surface-container-high transition-colors text-left" data-req-id="${req.id}" data-req-name="${req.name}">
                          <span class="material-symbols-outlined text-[18px] text-outline">badge</span>
                          ${t('dashboard.actionCreateCert')}
                        </button>
                        ` : ''}
                        ${!isCancelledByEmp && req.status !== 'rejected' && req.status !== 'approved' && req.status !== 'cancelled' ? `
                        <hr class="border-t border-outline-variant mx-3">
                        <button class="btn-reject w-full flex items-center gap-3 px-4 py-3 text-label-md text-error hover:bg-error-container/20 transition-colors text-left" data-req-id="${req.id}" data-req-name="${req.name}">
                          <span class="material-symbols-outlined text-[18px]">cancel</span>
                          ${t('dashboard.actionReject')}
                        </button>
                        ` : ''}
                      </div>
                    </div>
                  </td>
                </tr>
              `;
            }).join('') : `
              <tr><td colspan="8" class="p-8 text-center text-on-surface-variant">${t('common.noResults')}</td></tr>
            `}
          </tbody>
        </table>
      </div>
      ${totalPages > 1 ? `
      <div class="p-4 bg-surface-container-low border-t border-outline-variant">
        <div class="flex items-center justify-between">
          <p class="text-label-sm text-outline">${t('common.showing')} ${start + 1} ${t('common.to')} ${Math.min(start + perPage, filtered.length)} ${t('common.from')} ${filtered.length} ${t('common.items')}</p>
          <div class="flex gap-2">
            <button class="btn-page p-2 border border-outline-variant rounded-lg hover:bg-surface-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed" data-page="${safePage - 1}" ${safePage <= 1 ? 'disabled' : ''}>
              <span class="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            ${Array.from({length: totalPages}, (_, i) => i + 1).map(p => `
              <button class="btn-page w-9 h-9 rounded-lg text-label-sm font-bold transition-colors ${p === safePage ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container'}" data-page="${p}">${p}</button>
            `).join('')}
            <button class="btn-page p-2 border border-outline-variant rounded-lg hover:bg-surface-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed" data-page="${safePage + 1}" ${safePage >= totalPages ? 'disabled' : ''}>
              <span class="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
      ` : ''}
    </div>

    <!-- Trends Chart + SLA Alerts -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
      <!-- Chart Area -->
      <div class="lg:col-span-2 tonal-card p-6 border border-outline-variant flex flex-col">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-headline-md font-bold text-primary">${t('dashboard.chartTitle')}</h3>
          <div class="flex items-center gap-1">
            <button class="btn-chart-period px-3 py-1.5 rounded-lg text-label-sm font-bold transition-colors ${chartPeriod === '6m' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}" data-period="6m">${t('dashboard.chart6m')}</button>
            <button class="btn-chart-period px-3 py-1.5 rounded-lg text-label-sm font-bold transition-colors ${chartPeriod === '1y' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}" data-period="1y">${t('dashboard.chart1y')}</button>
          </div>
        </div>

        <!-- Chart -->
        <div class="flex flex-col mt-4">
          <!-- Legend -->
          <div class="flex flex-wrap gap-3 mb-4 px-2">
            <span class="flex items-center gap-1.5 text-[11px] text-on-surface-variant"><span class="w-3 h-3 rounded-sm bg-primary"></span>${t('dashboard.chartAll') || 'ทั้งหมด'}</span>
            <span class="flex items-center gap-1.5 text-[11px] text-on-surface-variant"><span class="w-3 h-3 rounded-sm" style="background:#F59E0B"></span>${t('dashboard.chartPending') || 'รอตรวจสอบ'}</span>
            <span class="flex items-center gap-1.5 text-[11px] text-on-surface-variant"><span class="w-3 h-3 rounded-sm" style="background:#22C55E"></span>${t('dashboard.chartApproved') || 'อนุมัติแล้ว'}</span>
            <span class="flex items-center gap-1.5 text-[11px] text-on-surface-variant"><span class="w-3 h-3 rounded-sm" style="background:#EF4444"></span>${t('dashboard.chartRejected') || 'ปฏิเสธ'}</span>
            <span class="flex items-center gap-1.5 text-[11px] text-on-surface-variant"><span class="w-3 h-3 rounded-sm" style="background:#9E9E9E"></span>${t('dashboard.chartCancelled') || 'ยกเลิก'}</span>
          </div>

          <!-- Bars -->
          <div id="chart-bars" class="flex items-end justify-between gap-2 relative" style="height:200px;padding-top:24px;">
            <div class="absolute inset-x-0 top-6 bottom-0 flex flex-col justify-between pointer-events-none opacity-20">
              <div class="w-full h-px bg-outline-variant"></div>
              <div class="w-full h-px bg-outline-variant"></div>
              <div class="w-full h-px bg-outline-variant"></div>
              <div class="w-full h-px bg-outline-variant"></div>
            </div>

            ${chartMonths.map((month, i) => {
              const maxVal = Math.max(...chartTotal, 1);
              const barH = Math.max((chartTotal[i] / maxVal) * 100, chartTotal[i] > 0 ? 8 : 0);
              const segs = [];
              if (chartTotal[i] > 0) {
                const total = chartTotal[i];
                if (chartCancelled[i]) segs.push(`<div style="height:${(chartCancelled[i]/total)*100}%;background:#9E9E9E;" class="w-full"></div>`);
                if (chartRejected[i]) segs.push(`<div style="height:${(chartRejected[i]/total)*100}%;background:#EF4444;" class="w-full"></div>`);
                if (chartApproved[i]) segs.push(`<div style="height:${(chartApproved[i]/total)*100}%;background:#22C55E;" class="w-full"></div>`);
                if (chartPending[i]) segs.push(`<div style="height:${(chartPending[i]/total)*100}%;background:#F59E0B;" class="w-full"></div>`);
              }
              const tip = `${month}\n${t('dashboard.chartAll')}: ${chartTotal[i]}\n${t('dashboard.chartPending')}: ${chartPending[i]}\n${t('dashboard.chartApproved')}: ${chartApproved[i]}\n${t('dashboard.chartRejected')}: ${chartRejected[i]}\n${t('dashboard.chartCancelled')}: ${chartCancelled[i]}`;
              return `
                <div class="flex flex-col items-center flex-1 z-10 cursor-pointer" title="${tip}">
                  <span class="text-[11px] font-bold text-primary mb-1 leading-none">${chartTotal[i]}</span>
                  <div class="w-full max-w-[40px] flex flex-col justify-end rounded-t-sm" style="height:${barH}%;">
                    ${segs.join('') || '<div style="height:2%;background:var(--md-sys-color-outline-variant);" class="w-full"></div>'}
                  </div>
                  <span class="text-label-sm text-outline mt-2">${month}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- SLA Alerts -->
      <div class="tonal-card p-6 border border-outline-variant">
        <h3 class="text-headline-md font-bold text-primary mb-6 flex items-center gap-2">
          <span class="material-symbols-outlined text-error">notifications_active</span>
          ${t('dashboard.slaTitle')}
        </h3>
        <div class="space-y-3">
          ${pending.filter(r => r.status === 'submitted' || r.status === 'in-review').length > 0 ? `
            <div class="p-4 rounded-lg border-l-4 border-amber-600 bg-amber-50">
              <p class="text-label-sm font-bold text-amber-900 mb-1">${t('dashboard.slaWarning', { count: pending.filter(r => r.status === 'submitted' || r.status === 'in-review').length })}</p>
              <p class="text-label-sm text-amber-800 leading-snug">${t('dashboard.slaWarningDetail')}</p>
            </div>
          ` : `
            <div class="p-4 rounded-lg border-l-4 border-green-600 bg-green-50">
              <p class="text-label-sm font-bold text-green-900 mb-1">${t('dashboard.slaOk')}</p>
              <p class="text-label-sm text-green-800 leading-snug">${t('dashboard.slaOkDetail')}</p>
            </div>
          `}
        </div>
        <button class="w-full mt-6 py-2 border border-primary text-primary rounded-lg text-label-md font-bold hover:bg-primary/5 transition-colors">
          ${t('dashboard.viewAllAlerts')}
        </button>
      </div>
    </div>

    <!-- ===== Detail Modal (HR) ===== -->
    <div id="detail-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 hidden">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="detail-modal-backdrop"></div>
      <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" style="max-height:90vh">
        <div class="h-1.5 bg-primary w-full"></div>
        <div class="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-primary">description</span>
            <h3 class="text-title-md font-bold text-on-surface">${t('dashboard.modalDetailTitle')}</h3>
          </div>
          <button id="detail-modal-close" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-outline transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <!-- Missing-fields warning banner -->
        <div id="dt-missing-banner" class="hidden mx-6 mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shrink-0">
          <div class="flex items-start gap-2">
            <span class="material-symbols-outlined text-amber-600 text-[20px] mt-0.5 shrink-0">warning</span>
            <div>
              <p class="text-label-sm font-bold text-amber-900">ข้อมูลไม่ครบถ้วน — แนะนำให้ปฏิเสธและขอข้อมูลเพิ่มเติม</p>
              <ul id="dt-missing-list" class="mt-1 list-disc list-inside text-label-xs text-amber-800 space-y-0.5"></ul>
            </div>
          </div>
        </div>

        <div class="px-6 pb-6 overflow-y-auto">
          <div id="detail-modal-body" class="space-y-4">

            <!-- Employee Info Section -->
            <p class="text-label-xs font-bold text-outline uppercase tracking-widest">ข้อมูลพนักงาน</p>
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-surface-container rounded-xl px-4 py-3 col-span-2">
                <p class="text-label-xs text-outline">ชื่อ-นามสกุล</p>
                <p class="text-label-md font-semibold text-on-surface" id="dt-emp-name">-</p>
              </div>
              <div class="bg-surface-container rounded-xl px-4 py-3">
                <p class="text-label-xs text-outline">รหัสพนักงาน</p>
                <p class="text-label-md font-semibold text-on-surface" id="dt-emp-id">-</p>
              </div>
              <div class="bg-surface-container rounded-xl px-4 py-3">
                <p class="text-label-xs text-outline">แผนก</p>
                <p class="text-label-md font-semibold text-on-surface" id="dt-dept">-</p>
              </div>
              <div class="bg-surface-container rounded-xl px-4 py-3">
                <p class="text-label-xs text-outline">ตำแหน่ง</p>
                <p class="text-label-md font-semibold text-on-surface" id="dt-position">-</p>
              </div>
              <div class="bg-surface-container rounded-xl px-4 py-3">
                <p class="text-label-xs text-outline">เบอร์โทรศัพท์</p>
                <p class="text-label-md font-semibold text-on-surface" id="dt-phone">-</p>
              </div>
              <div class="bg-surface-container rounded-xl px-4 py-3">
                <p class="text-label-xs text-outline">วันที่เริ่มงาน</p>
                <p class="text-label-md font-semibold text-on-surface" id="dt-start-date">-</p>
              </div>
              <div class="bg-surface-container rounded-xl px-4 py-3">
                <p class="text-label-xs text-outline">บริษัท</p>
                <p class="text-label-md font-semibold text-on-surface" id="dt-company">-</p>
              </div>
            </div>

            <!-- Request Details Section -->
            <p class="text-label-xs font-bold text-outline uppercase tracking-widest pt-2">รายละเอียดคำขอ</p>
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-surface-container rounded-xl px-4 py-3">
                <p class="text-label-xs text-outline">${t('common.type')}</p>
                <p class="text-label-md font-semibold text-on-surface" id="dt-doc-type">-</p>
              </div>
              <div class="bg-surface-container rounded-xl px-4 py-3">
                <p class="text-label-xs text-outline">${t('newReq.labelPurpose')}</p>
                <p class="text-label-md font-semibold text-on-surface" id="dt-purpose">-</p>
              </div>
              <div class="bg-surface-container rounded-xl px-4 py-3">
                <p class="text-label-xs text-outline">${t('newReq.labelLanguage')}</p>
                <p class="text-label-md font-semibold text-on-surface" id="dt-language">-</p>
              </div>
              <div class="bg-surface-container rounded-xl px-4 py-3">
                <p class="text-label-xs text-outline">${t('newReq.labelSalary')}</p>
                <p class="text-label-md font-semibold text-on-surface" id="dt-salary">-</p>
              </div>
              <div class="bg-surface-container rounded-xl px-4 py-3">
                <p class="text-label-xs text-outline">${t('newReq.sectionDelivery')}</p>
                <p class="text-label-md font-semibold text-on-surface" id="dt-delivery">-</p>
              </div>
              <div class="bg-surface-container rounded-xl px-4 py-3">
                <p class="text-label-xs text-outline">สถานที่รับเอกสาร</p>
                <p class="text-label-md font-semibold text-on-surface" id="dt-pickup">-</p>
              </div>
              <div class="bg-surface-container rounded-xl px-4 py-3">
                <p class="text-label-xs text-outline">${t('dashboard.tableDate')}</p>
                <p class="text-label-md font-semibold text-on-surface" id="dt-date">-</p>
              </div>
              <div class="bg-surface-container rounded-xl px-4 py-3">
                <p class="text-label-xs text-outline">เจ้าหน้าที่ HR ที่เลือก</p>
                <p class="text-label-md font-semibold text-on-surface" id="dt-hr-officer">-</p>
              </div>
            </div>

            <!-- Employee Notes -->
            <div class="bg-surface-container rounded-xl px-4 py-3">
              <p class="text-label-xs text-outline mb-2">${t('newReq.labelNotes')}</p>
              <p class="text-label-md font-semibold text-on-surface whitespace-pre-wrap" id="dt-notes">-</p>
            </div>

            <!-- Attachments -->
            <div class="bg-surface-container rounded-xl px-4 py-3">
              <p class="text-label-xs text-outline mb-2">${t('common.attachments')}</p>
              <div id="dt-attachments" class="flex flex-wrap gap-2"></div>
            </div>

            <!-- Issued certificate record (HR cross-check) -->
            <div id="dt-issue-section" class="hidden space-y-3 pt-2">
              <p class="text-label-xs font-bold text-outline uppercase tracking-widest">${t('dashboard.issueRecordTitle')}</p>
              <div id="dt-issue-mismatch" class="hidden rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-label-sm text-amber-900"></div>
              <div class="grid grid-cols-2 gap-3">
                <div class="bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 col-span-2">
                  <p class="text-label-xs text-outline">${t('dashboard.issueCertNumber')}</p>
                  <p class="text-label-md font-bold text-primary" id="dt-issue-cert-no">-</p>
                </div>
                <div class="bg-surface-container rounded-xl px-4 py-3">
                  <p class="text-label-xs text-outline">${t('dashboard.issueDate')}</p>
                  <p class="text-label-md font-semibold text-on-surface" id="dt-issue-date">-</p>
                </div>
                <div class="bg-surface-container rounded-xl px-4 py-3">
                  <p class="text-label-xs text-outline">${t('dashboard.issueTemplate')}</p>
                  <p class="text-label-md font-semibold text-on-surface" id="dt-issue-template">-</p>
                </div>
                <div class="bg-surface-container rounded-xl px-4 py-3 col-span-2">
                  <p class="text-label-xs text-outline">${t('dashboard.issueHrbpOnDoc')}</p>
                  <p class="text-label-md font-semibold text-on-surface" id="dt-issue-hrbp">-</p>
                  <p class="text-label-xs text-outline mt-1" id="dt-issue-hrbp-contact">-</p>
                </div>
                <div class="bg-surface-container rounded-xl px-4 py-3 col-span-2">
                  <p class="text-label-xs text-outline">${t('dashboard.issueSigner')}</p>
                  <p class="text-label-md font-semibold text-on-surface" id="dt-issue-signer">-</p>
                </div>
                <div class="bg-surface-container rounded-xl px-4 py-3 col-span-2">
                  <p class="text-label-xs text-outline">${t('dashboard.issueRemark')}</p>
                  <p class="text-label-md font-semibold text-on-surface whitespace-pre-wrap" id="dt-issue-remark">-</p>
                </div>
                <div class="bg-surface-container rounded-xl px-4 py-3">
                  <p class="text-label-xs text-outline">${t('dashboard.issueBy')}</p>
                  <p class="text-label-md font-semibold text-on-surface" id="dt-issue-by">-</p>
                </div>
                <div class="bg-surface-container rounded-xl px-4 py-3">
                  <p class="text-label-xs text-outline">${t('dashboard.issueSavedAt')}</p>
                  <p class="text-label-md font-semibold text-on-surface" id="dt-issue-saved-at">-</p>
                </div>
              </div>
            </div>

            <!-- Delivery Status (for physical documents) -->
            <div id="dt-delivery-status-section" class="hidden space-y-3 pt-2">
              <p class="text-label-xs font-bold text-outline uppercase tracking-widest">${t('dashboard.deliveryStatus')}</p>
              <div class="grid grid-cols-2 gap-3">
                <div class="bg-surface-container rounded-xl px-4 py-3">
                  <p class="text-label-xs text-outline">${t('dashboard.deliveryStatus')}</p>
                  <p class="text-label-md font-semibold" id="dt-delivery-status-value">-</p>
                </div>
                <div class="bg-surface-container rounded-xl px-4 py-3">
                  <p class="text-label-xs text-outline">${t('newReq.labelPickup')}</p>
                  <p class="text-label-md font-semibold text-on-surface" id="dt-delivery-pickup">-</p>
                </div>
              </div>
              <button id="btn-mark-delivered" class="w-full py-3 bg-tertiary text-on-tertiary font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-[18px]">check_circle</span>
                ${t('dashboard.markDelivered')}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>

    <!-- ===== ETA Setting Modal (HR) ===== -->
    <!-- แนวทาง: HR คลิก "ตั้ง ETA" ที่ตารางคำขอ → เลือกวัน → บันทึก → ระบบอัปเดต eta_date ใน DB → พนักงานเห็น ETA ที่หน้าหลัก -->
    <div id="eta-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 hidden">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="eta-modal-backdrop"></div>
      <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div class="h-1.5 bg-primary w-full"></div>
        <div class="flex items-center justify-between px-6 pt-5 pb-3">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-primary">schedule</span>
            <h3 class="text-title-md font-bold text-on-surface">${t('dashboard.modalEtaTitle')}</h3>
          </div>
          <button id="eta-modal-close" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-outline transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div class="px-6 pb-6">
          <p id="eta-modal-req-name" class="text-label-sm text-on-surface-variant mb-5">${t('dashboard.reqOf')} -</p>
          <label class="block text-label-md font-semibold text-on-surface-variant mb-2">${t('dashboard.etaLabel')} <span class="text-error">*</span></label>
          <input id="eta-date-input" type="date" class="w-full bg-white border border-outline-variant rounded-lg px-4 py-3 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-on-surface font-medium mb-2" />
          <p class="text-label-xs text-outline mb-5">${t('dashboard.etaNote')}</p>
          <div class="flex gap-3">
            <button id="eta-modal-cancel" class="flex-1 py-3 border border-outline-variant text-on-surface-variant font-bold rounded-xl hover:bg-surface-container transition-colors">${t('common.cancel')}</button>
            <button id="eta-modal-save" class="flex-[2] py-3 bg-primary text-on-primary font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[18px]">save</span>
              ${t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Rejection Modal (HR) ===== -->
    <div id="reject-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 hidden">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="reject-modal-backdrop"></div>
      <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div class="h-1.5 bg-error w-full"></div>
        <div class="flex items-center justify-between px-6 pt-5 pb-3">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-error">cancel</span>
            <h3 class="text-title-md font-bold text-on-surface">${t('dashboard.modalRejectTitle')}</h3>
          </div>
          <button id="reject-modal-close" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-outline transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div class="px-6 pb-6">
          <p id="reject-modal-req-name" class="text-label-sm text-on-surface-variant mb-5">${t('dashboard.reqOf')} -</p>
          <label class="block text-label-md font-semibold text-on-surface-variant mb-2">${t('dashboard.rejectLabel')} <span class="text-error">*</span></label>
          <textarea id="reject-reason-input" class="w-full bg-white border border-outline-variant rounded-xl px-4 py-3 focus:border-error focus:ring-4 focus:ring-error/10 transition-all outline-none text-on-surface font-medium resize-none" rows="4" placeholder="${t('dashboard.rejectPlaceholder')}"></textarea>
          <p class="text-label-xs text-outline mb-5">${t('dashboard.rejectPlaceholder')}</p>
          <div class="flex gap-3">
            <button id="reject-modal-cancel" class="flex-1 py-3 border border-outline-variant text-on-surface-variant font-bold rounded-xl hover:bg-surface-container transition-colors">${t('common.cancel')}</button>
            <button id="reject-modal-save" class="flex-[2] py-3 bg-error text-on-error font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[18px]">cancel</span>
              ${t('common.reject')}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initAdminDashboard(container) {
  container.querySelectorAll('#pending-table-body img[data-avatar-emp-id]').forEach(img => {
    loadAvatarForElement(img, img.getAttribute('data-avatar-emp-id'));
  });

  // ── Chart animations ──────────────────────────────────────────
  setTimeout(() => {
    const bars = container.querySelectorAll('#chart-bars > div');
    bars.forEach(bar => {
      const inner = bar.querySelector('[style*="height"]');
      if (!inner) return;
      const targetHeight = inner.style.height;
      inner.style.height = '0%';
      setTimeout(() => {
        inner.style.transition = 'height 1s cubic-bezier(0.34, 1.56, 0.64, 1)';
        inner.style.height = targetHeight;
      }, 50);
    });
  }, 100);

  // ── Dashboard refresh helper (replaces setTimeout+hashchange pattern) ──
  // Re-renders only the dynamic content (KPIs, table, pagination, chart, SLA)
  // without a full page reload, then re-binds event handlers for new elements.
  const refreshDashboard = async () => {
    // Show loading indicator (create if not exists)
    let loadingOverlay = container.querySelector('#admin-loading');
    if (!loadingOverlay) {
      loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'admin-loading';
      loadingOverlay.className = 'fixed inset-0 z-[150] flex items-center justify-center hidden';
      loadingOverlay.innerHTML = `<div class="absolute inset-0 bg-black/20 backdrop-blur-sm"></div><div class="relative flex flex-col items-center gap-4 bg-surface-container-lowest px-8 py-6 rounded-2xl shadow-2xl"><div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div><span class="text-label-md font-bold text-on-surface">${t('common.loading')}</span></div>`;
      container.appendChild(loadingOverlay);
    }
    loadingOverlay.classList.remove('hidden');

    try {
      const data = await getEmployeeRequests({ page: 1, limit: 100, search: '', status: '' });
      // Sync fetched data into dataService cache for cross-component consistency
      await dataService.fetchRequests({ page: 1, limit: 100, search: '', status: '' });
      const { kpis, pending, chart } = computeDashboardData(data);
      _lastPendingData = pending;

      const chartPeriod = sessionStorage.getItem('dashboard-chart-period') || '6m';
      const slice = chartPeriod === '6m' ? -6 : undefined;
      const chartMonths = chart.months.slice(slice);
      const chartTotal = chart.total.slice(slice);
      const chartPending = chart.pending.slice(slice);
      const chartApproved = chart.approved.slice(slice);
      const chartRejected = chart.rejected.slice(slice);
      const chartCancelled = chart.cancelled.slice(slice);
      const filterStatus = getDashboardFilterStatus();
      const perPage = 5;
      const filtered = filterDashboardPending(pending, filterStatus);
      const page = parseInt(sessionStorage.getItem('dashboard-pending-page') || '1');
      const totalPages = Math.ceil(filtered.length / perPage) || 1;
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * perPage;
      const pageItems = filtered.slice(start, start + perPage);

      // Build updated KPI HTML
      const kpisHtml = kpis.map(kpi => {
        let borderClass = 'border-outline-variant';
        let iconBgClass = 'bg-surface-container-high';
        let iconColorClass = 'text-on-surface-variant';
        let subtextClass = 'text-outline';
        let valueColor = 'text-primary';
        if (kpi.color === 'success') { borderClass = 'border-green-200'; iconBgClass = 'bg-green-100'; iconColorClass = 'text-green-700'; subtextClass = 'text-green-700 font-bold'; }
        else if (kpi.color === 'error') { borderClass = 'border-red-200'; iconBgClass = 'bg-red-100'; iconColorClass = 'text-red-700'; valueColor = 'text-red-700'; subtextClass = 'text-red-700 font-bold'; }
        const isActive = filterStatus === kpi.filterValue;
        return `<div class="kpi-card tonal-card p-5 border ${borderClass} relative overflow-hidden group transition-all cursor-pointer ${isActive ? 'ring-2 ring-primary shadow-md' : 'hover:border-primary/50'}" data-filter-value="${kpi.filterValue}">
          <div class="flex justify-between items-start mb-2">
            <div class="w-10 h-10 rounded-lg ${iconBgClass} ${iconColorClass} flex items-center justify-center"><span class="material-symbols-outlined text-[20px]">${kpi.icon}</span></div>
            ${kpi.sublabel ? `<span class="text-[10px] ${subtextClass}">${kpi.sublabel}</span>` : ''}
          </div>
          <p class="text-label-sm text-on-surface-variant mt-2 mb-1">${kpi.label}</p>
          <h3 class="text-display font-display ${valueColor} leading-none tracking-tight">${kpi.value}</h3>
        </div>`;
      }).join('');

      // Update KPI section
      const kpiGrid = container.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-5');
      if (kpiGrid) kpiGrid.innerHTML = kpisHtml;

      // Build table rows HTML
      const rowsHtml = pageItems.length > 0 ? pageItems.map(req => {
        let badgeClass = 'bg-surface-container-highest text-on-surface-variant font-bold';
        const isCancelledByEmp = isEmployeeCancelled(req);
        if (isCancelledByEmp) badgeClass = 'bg-surface-container-highest text-outline font-bold';
        else if (req.status === 'rejected') badgeClass = 'bg-[#fee2e2] text-[#991b1b] font-bold';
        else if (req.status === 'in-review' && !req.eta_date) badgeClass = 'bg-[#fef3c7] text-[#92400e] font-bold';
        else if (req.status === 'in-review' && req.eta_date) badgeClass = 'bg-[#dce1ff] text-primary font-bold';
        else if (req.status === 'approved') badgeClass = 'bg-[#dcfce7] text-[#166534] font-bold';
        else if (req.eta_date) badgeClass = 'bg-[#dce1ff] text-primary font-bold';

        return `<tr class="hover:bg-surface-container-low transition-colors">
          <td class="px-6 py-4"><div class="flex items-center gap-3 whitespace-nowrap">
            ${renderRequesterAvatar(req)}
            <div><p class="text-label-md font-bold text-on-surface">${req.name}</p><p class="text-[10px] text-outline">${req.phone}</p></div>
          </div></td>
          <td class="px-6 py-4 text-label-sm text-on-surface-variant whitespace-nowrap">${req.department}</td>
          <td class="px-6 py-4 text-label-md text-on-surface whitespace-nowrap">${req.type}</td>
          <td class="px-6 py-4 whitespace-nowrap"><span class="px-2.5 py-1 rounded-md text-[10px] whitespace-nowrap ${badgeClass}">${req.statusLabel}</span></td>
          <td class="px-6 py-4 text-label-sm text-on-surface-variant whitespace-nowrap">${req.date}</td>
          <td class="px-6 py-4 text-label-sm text-on-surface-variant whitespace-nowrap">${formatThaiDate(req.eta_date)}</td>
          <td class="px-6 py-4 whitespace-nowrap"><div class="flex flex-col gap-1">
            ${req.hr_officer ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-fixed/20 text-primary rounded text-[10px] font-bold"><span class="material-symbols-outlined text-[12px]">person_pin</span>${t('dashboard.hrSelected')} ${req.hr_officer}</span>` : ''}
            ${req.acknowledged_by ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-[#dcfce7] text-[#166534] rounded text-[10px] font-bold"><span class="material-symbols-outlined text-[12px]">verified</span>${t('dashboard.hrAcknowledged')} ${req.acknowledged_by}</span>` : '<span class="text-[10px] text-outline">-</span>'}
          </div></td>
          <td class="px-6 py-4 text-right whitespace-nowrap"><div class="relative dropdown-manage">
            <button class="btn-dropdown-toggle text-primary hover:bg-primary/10 p-1.5 rounded transition-colors" data-req-id="${req.id}"><span class="material-symbols-outlined text-[18px]">more_vert</span></button>
            <div class="dropdown-menu hidden absolute right-0 top-full mt-1 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl z-50 min-w-[180px] overflow-hidden">
              <button class="btn-view-detail w-full flex items-center gap-3 px-4 py-3 text-label-md text-on-surface hover:bg-surface-container-high transition-colors text-left" data-req-id="${req.id}"><span class="material-symbols-outlined text-[18px] text-outline">visibility</span>${t('dashboard.actionView')}</button>
              ${(req.status === 'submitted' || (req.status === 'in-review' && !req.eta_date)) ? `<button class="btn-acknowledge w-full flex items-center gap-3 px-4 py-3 text-label-md text-on-surface hover:bg-surface-container-high transition-colors text-left" data-req-id="${req.id}" data-req-name="${req.name}"><span class="material-symbols-outlined text-[18px] text-outline">handshake</span>${t('dashboard.actionAck')}</button>` : ''}
              ${req.eta_date ? `<button class="btn-edit-eta w-full flex items-center gap-3 px-4 py-3 text-label-md text-on-surface hover:bg-surface-container-high transition-colors text-left" data-req-id="${req.id}" data-req-name="${req.name}"><span class="material-symbols-outlined text-[18px] text-outline">schedule</span>${t('dashboard.actionEta')}</button>
              <button class="btn-create-cert w-full flex items-center gap-3 px-4 py-3 text-label-md text-on-surface hover:bg-surface-container-high transition-colors text-left" data-req-id="${req.id}" data-req-name="${req.name}"><span class="material-symbols-outlined text-[18px] text-outline">badge</span>${t('dashboard.actionCreateCert')}</button>` : ''}
              ${!isCancelledByEmp && req.status !== 'rejected' && req.status !== 'approved' && req.status !== 'cancelled' ? `<hr class="border-t border-outline-variant mx-3"><button class="btn-reject w-full flex items-center gap-3 px-4 py-3 text-label-md text-error hover:bg-error-container/20 transition-colors text-left" data-req-id="${req.id}" data-req-name="${req.name}"><span class="material-symbols-outlined text-[18px]">cancel</span>${t('dashboard.actionReject')}</button>` : ''}
            </div>
          </div></td>
        </tr>`;
      }).join('') : `<tr><td colspan="8" class="p-8 text-center text-on-surface-variant">${t('common.noResults')}</td></tr>`;

      // Update table body
      const tbody = container.querySelector('#pending-table-body');
      if (tbody) tbody.innerHTML = rowsHtml;

      // Update pagination
      const paginationWrap = container.querySelector('.tonal-card .p-4.bg-surface-container-low');
      if (paginationWrap) {
        paginationWrap.innerHTML = totalPages > 1 ? `<div class="flex items-center justify-between">
          <p class="text-label-sm text-outline">${t('common.showing')} ${start + 1} ${t('common.to')} ${Math.min(start + perPage, filtered.length)} ${t('common.from')} ${filtered.length} ${t('common.items')}</p>
          <div class="flex gap-2">
            <button class="btn-page p-2 border border-outline-variant rounded-lg hover:bg-surface-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed" data-page="${safePage - 1}" ${safePage <= 1 ? 'disabled' : ''}><span class="material-symbols-outlined text-[18px]">chevron_left</span></button>
            ${Array.from({length: totalPages}, (_, i) => i + 1).map(p => `<button class="btn-page w-9 h-9 rounded-lg text-label-sm font-bold transition-colors ${p === safePage ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container'}" data-page="${p}">${p}</button>`).join('')}
            <button class="btn-page p-2 border border-outline-variant rounded-lg hover:bg-surface-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed" data-page="${safePage + 1}" ${safePage >= totalPages ? 'disabled' : ''}><span class="material-symbols-outlined text-[18px]">chevron_right</span></button>
          </div>
        </div>` : '';
      }

      // Update chart bars
      const chartBarsContainer = container.querySelector('#chart-bars');
      if (chartBarsContainer) {
        // Keep grid lines, replace only bar elements
        const gridLines = chartBarsContainer.querySelector('.absolute');
        chartBarsContainer.innerHTML = '';
        if (gridLines) chartBarsContainer.appendChild(gridLines);
        const barHtml = chartMonths.map((month, i) => {
          const maxVal = Math.max(...chartTotal, 1);
          const barH = Math.max((chartTotal[i] / maxVal) * 100, chartTotal[i] > 0 ? 8 : 0);
          const segs = [];
          if (chartTotal[i] > 0) {
            const total = chartTotal[i];
            if (chartCancelled[i]) segs.push(`<div style="height:${(chartCancelled[i]/total)*100}%;background:#9E9E9E;" class="w-full"></div>`);
            if (chartRejected[i]) segs.push(`<div style="height:${(chartRejected[i]/total)*100}%;background:#EF4444;" class="w-full"></div>`);
            if (chartApproved[i]) segs.push(`<div style="height:${(chartApproved[i]/total)*100}%;background:#22C55E;" class="w-full"></div>`);
            if (chartPending[i]) segs.push(`<div style="height:${(chartPending[i]/total)*100}%;background:#F59E0B;" class="w-full"></div>`);
          }
          const tip = `${month}\n${t('dashboard.chartAll')}: ${chartTotal[i]}\n${t('dashboard.chartPending')}: ${chartPending[i]}\n${t('dashboard.chartApproved')}: ${chartApproved[i]}\n${t('dashboard.chartRejected')}: ${chartRejected[i]}\n${t('dashboard.chartCancelled')}: ${chartCancelled[i]}`;
          return `
            <div class="flex flex-col items-center flex-1 z-10 cursor-pointer" title="${tip}">
              <span class="text-[11px] font-bold text-primary mb-1 leading-none">${chartTotal[i]}</span>
              <div class="w-full max-w-[40px] flex flex-col justify-end rounded-t-sm" style="height:${barH}%;">
                ${segs.join('') || '<div style="height:2%;background:var(--md-sys-color-outline-variant);" class="w-full"></div>'}
              </div>
              <span class="text-label-sm text-outline mt-2">${month}</span>
            </div>
          `;
        }).join('');
        chartBarsContainer.insertAdjacentHTML('beforeend', barHtml);
      }

      // Re-bind event handlers for new DOM elements
      container.querySelectorAll('#pending-table-body img[data-avatar-emp-id]').forEach(img => {
        loadAvatarForElement(img, img.getAttribute('data-avatar-emp-id'));
      });
      container.querySelectorAll('.btn-dropdown-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          container.querySelectorAll('.dropdown-menu').forEach(m => m.classList.add('hidden'));
          const menu = btn.nextElementSibling;
          if (menu) menu.classList.toggle('hidden');
        });
      });
      container.querySelectorAll('.btn-acknowledge').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const reqName = btn.getAttribute('data-req-name') || t('dashboard.thisRequest');
          currentReqId = btn.getAttribute('data-req-id') || '';
          openEtaModal(reqName);
        });
      });
      container.querySelectorAll('.btn-edit-eta').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const reqName = btn.getAttribute('data-req-name') || t('dashboard.thisRequest');
          currentReqId = btn.getAttribute('data-req-id') || '';
          const rawReqs = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
          const raw = rawReqs.find(r => r.id === currentReqId) || {};
          openEtaModal(reqName, raw.eta_date || '');
        });
      });
      container.querySelectorAll('.btn-view-detail').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const reqId = btn.getAttribute('data-req-id') || '';
          const raw = _lastPendingData.find(r => String(r.id) === String(reqId)) || {};
          // Populate detail modal fields
          const setField = (id, val) => {
            const el = container.querySelector(`#${id}`);
            if (!el) return;
            const v = val || '';
            el.textContent = v || '-';
            el.closest('.bg-surface-container')?.classList.toggle('ring-1', !v);
            el.closest('.bg-surface-container')?.classList.toggle('ring-amber-400', !v);
          };
          setField('dt-emp-name', raw.full_name || raw.name || '');
          setField('dt-emp-id', raw.emp_id || '');
          setField('dt-dept', raw.department || '');
          setField('dt-position', raw.position || '');
          setField('dt-phone', raw.phone || '');
          setField('dt-start-date', raw.start_date || '');
          setField('dt-company', raw.company_name || '');
          setField('dt-doc-type', raw.type || raw.doc_type || '');
          setField('dt-purpose', raw.purpose || '');
          setField('dt-language', raw.language || '');
          setField('dt-salary', raw.salary || '');
          const deliveryValue = raw.delivery_value || raw.delivery || '';
          setField('dt-delivery', raw.delivery || '');
          setField('dt-pickup', raw.pickup_location || (!deliveryValue.includes('physical') ? 'ไม่ระบุ (ไม่ใช่การรับที่สำนักงาน)' : ''));
          setField('dt-date', raw.date || '');
          setField('dt-hr-officer', raw.hr_officer || '');
          const notesEl = container.querySelector('#dt-notes');
          if (notesEl) notesEl.textContent = (raw.notes || '').trim() || '-';
          const issueSection = container.querySelector('#dt-issue-section');
          if (issueSection) {
            const snap = raw.cert_issue_snapshot || (raw.request_data?.cert_issue_snapshot) || null;
            if (raw.cert_ready && (snap || raw.cert_number)) {
              issueSection.classList.remove('hidden');
              setField('dt-issue-cert-no', snap?.cert_number || raw.cert_number || '');
              setField('dt-issue-date', snap?.cert_issued_date || raw.cert_issued_date || '');
              setField('dt-issue-template', snap?.cert_template_name || raw.cert_template_name || '');
              setField('dt-issue-hrbp', snap?.hr_officer_name || raw.hr_officer || '-');
              const contactEl = container.querySelector('#dt-issue-hrbp-contact');
              if (contactEl) {
                const phone = snap?.hr_officer_phone || raw.hr_officer_phone || '';
                const email = snap?.hr_officer_email || raw.hr_officer_email || '';
                contactEl.textContent = [phone && `โทร. ${phone}`, email && `E-mail: ${email}`].filter(Boolean).join(' · ') || '-';
              }
              const signerEl = container.querySelector('#dt-issue-signer');
              if (signerEl) {
                const sName = snap?.hr_signer_name || raw.hr_signer_name || '';
                const sPos = snap?.hr_signer_position || raw.hr_signer_position || '';
                signerEl.textContent = sName ? `${sName}${sPos ? ` (${sPos})` : ''}` : '-';
              }
              setField('dt-issue-remark', snap?.hr_purpose_detail || raw.hr_purpose_detail || '');
              setField('dt-issue-by', snap?.issued_by_name || '-');
              const savedAtEl = container.querySelector('#dt-issue-saved-at');
              if (savedAtEl && snap?.saved_at) {
                const d = new Date(snap.saved_at);
                savedAtEl.textContent = Number.isNaN(d.getTime()) ? snap.saved_at : d.toLocaleString('th-TH');
              } else if (savedAtEl) savedAtEl.textContent = raw.cert_issued_date || '-';
              const mismatchEl = container.querySelector('#dt-issue-mismatch');
              if (mismatchEl) {
                const requestHrbp = snap?.request_hr_officer_name || raw.hr_officer || '';
                const issuedHrbp = snap?.hr_officer_name || raw.hr_officer || '';
                if (requestHrbp && issuedHrbp && requestHrbp !== issuedHrbp) {
                  mismatchEl.textContent = t('dashboard.issueHrbpMismatch', { request: requestHrbp, issued: issuedHrbp });
                  mismatchEl.classList.remove('hidden');
                } else mismatchEl.classList.add('hidden');
              }
            } else issueSection.classList.add('hidden');
          }
          const deliveryStatusSection = container.querySelector('#dt-delivery-status-section');
          if (deliveryStatusSection) {
            const hasPhysical = deliveryValue.includes('physical');
            deliveryStatusSection.classList.toggle('hidden', !hasPhysical);
          }
          detailModal?.classList.remove('hidden');
          document.body.style.overflow = 'hidden';
        });
      });
      container.querySelectorAll('.btn-reject').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const reqName = btn.getAttribute('data-req-name') || t('dashboard.thisRequest');
          const reqId = btn.getAttribute('data-req-id') || '';
          openRejectModal(reqName, reqId);
        });
      });
      container.querySelectorAll('.btn-create-cert').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const reqId = btn.getAttribute('data-req-id') || '';
          window.location.hash = `/admin/certificate-builder?reqId=${reqId}`;
        });
      });
      container.querySelectorAll('.btn-page').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const pg = parseInt(btn.getAttribute('data-page'), 10);
          if (isNaN(pg) || pg < 1 || pg > totalPages) return;
          sessionStorage.setItem('dashboard-pending-page', String(pg));
          refreshDashboard();
        });
      });
      container.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('click', () => {
          const val = card.getAttribute('data-filter-value');
          const current = sessionStorage.getItem('dashboard-pending-filter') || '';
          sessionStorage.setItem('dashboard-pending-page', '1');
          sessionStorage.setItem('dashboard-pending-filter', val === current ? '' : val);
          refreshDashboard();
        });
      });
      container.querySelectorAll('.btn-chart-period').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const period = btn.getAttribute('data-period');
          sessionStorage.setItem('dashboard-chart-period', period);
          refreshDashboard();
        });
      });
    } catch (err) {
      console.warn('[Dashboard] Refresh failed:', err);
    } finally {
      // Hide loading indicator
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
  };
  const showToast = (msg, icon = 'check_circle') => {
    let toast = container.querySelector('#admin-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'admin-toast';
      toast.className = 'fixed inset-0 z-[200] flex items-center justify-center hidden';
      toast.innerHTML = `<div class="absolute inset-0 bg-black/30"></div><div class="relative flex flex-col items-center gap-3 bg-surface-container-high border border-outline-variant px-8 py-6 rounded-2xl shadow-2xl text-label-md font-bold min-w-[300px] max-w-sm animate-[fadeIn_0.2s_ease-out]"><span class="admin-toast-icon material-symbols-outlined text-[36px] text-primary">${icon}</span><span class="admin-toast-msg text-on-surface text-center">${t('common.success')}</span></div>`;
      container.appendChild(toast);
    }
    toast.querySelector('.admin-toast-msg').textContent = msg;
    toast.querySelector('.admin-toast-icon').textContent = icon;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  };

  // ── Subscribe to DataService events for cross-component sync ──
  // When an employee cancels a request, the dashboard auto-refreshes
  // without the HR user needing to manually reload the page.
  const unsubscribeFromDataService = dataService.on('requests-updated', () => {
    if (!container.querySelector('#pending-table-body')) return; // not mounted
    refreshDashboard();
  });
  window.addEventListener('hashchange', () => unsubscribeFromDataService(), { once: true });

  // ── ETA Modal ─────────────────────────────────────────────────
  const etaModal = container.querySelector('#eta-modal');
  let currentReqName = '';
  const openEtaModal  = (reqName, prefillDate = '') => {
    if (!etaModal) return;
    currentReqName = reqName;
    container.querySelector('#eta-modal-req-name').textContent = `${t('dashboard.reqOf')} ${reqName}`;
    if (prefillDate) {
      container.querySelector('#eta-date-input').value = prefillDate;
    } else {
      // Default: 3 วันทำการ
      const d = new Date();
      let added = 0;
      while (added < 3) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() !== 0 && d.getDay() !== 6) added++;
      }
      container.querySelector('#eta-date-input').value = d.toISOString().split('T')[0];
    }
    etaModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };
  const closeEtaModal = () => {
    etaModal?.classList.add('hidden');
    document.body.style.overflow = '';
  };

  container.querySelector('#eta-modal-close')?.addEventListener('click', closeEtaModal);
  container.querySelector('#eta-modal-cancel')?.addEventListener('click', closeEtaModal);
  container.querySelector('#eta-modal-backdrop')?.addEventListener('click', closeEtaModal);

// ── ETA Modal: save — update via DataService ──
  let currentReqId = '';
  container.querySelector('#eta-modal-save')?.addEventListener('click', async () => {
    const dateVal = container.querySelector('#eta-date-input')?.value;
    if (!dateVal) { alert(t('dashboard.etaValidation')); return; }

    const currentHr = getCurrentUser();
    const acknowledgedBy = currentHr?.full_name || currentHr?.email || 'HR';

    closeEtaModal();
    showToast(t('dashboard.etaSaveSuccess'), 'schedule');

    // Centralized update through DataService (handles optimistic + API + rollback)
    dataService.updateRequest(currentReqId, {
      eta_date: dateVal,
      eta_submitted_at: new Date().toISOString().split('T')[0],
      status: 'in-review',
      statusLabel: t('status.inProgress'),
      acknowledged_by: acknowledgedBy,
}).catch(err => console.warn('[ETA] DataService update error:', err));
  });

  // ── Rejection Modal ─────────────────────────────────────────────
  const rejectModal = container.querySelector('#reject-modal');
  let currentRejectId = '';
  const openRejectModal = (reqName, reqId) => {
    if (!rejectModal) return;
    currentRejectId = reqId;
    container.querySelector('#reject-modal-req-name').textContent = `${t('dashboard.reqOf')} ${reqName}`;
    container.querySelector('#reject-reason-input').value = '';
    rejectModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };
  const closeRejectModal = () => {
    rejectModal?.classList.add('hidden');
    document.body.style.overflow = '';
  };

  container.querySelector('#reject-modal-close')?.addEventListener('click', closeRejectModal);
  container.querySelector('#reject-modal-cancel')?.addEventListener('click', closeRejectModal);
  container.querySelector('#reject-modal-backdrop')?.addEventListener('click', closeRejectModal);

  container.querySelector('#reject-modal-save')?.addEventListener('click', () => {
    const reason = container.querySelector('#reject-reason-input')?.value.trim();
    if (!reason) { alert(t('dashboard.rejectValidation')); return; }

    closeRejectModal();
    showToast(t('dashboard.rejectSuccess'), 'cancel');

    // Centralized update through DataService (handles optimistic + API + rollback)
    dataService.updateRequest(currentRejectId, {
      status: 'rejected',
      statusLabel: t('status.rejected'),
      rejection_reason: reason,
      rejected_by: getCurrentUser()?.full_name || 'HR',
      canResubmit: true,
      canCancel: false,
    }).catch(err => console.warn('[Reject] DataService update error:', err));
  });

  container.querySelectorAll('.btn-reject').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const reqName = btn.getAttribute('data-req-name') || t('dashboard.thisRequest');
      const reqId = btn.getAttribute('data-req-id') || '';
      openRejectModal(reqName, reqId);
    });
  });

  // Open editable certificate in Certificate Builder workspace
  container.querySelectorAll('.btn-create-cert').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const reqId = btn.getAttribute('data-req-id') || '';
      window.location.hash = `/admin/certificate-builder?reqId=${reqId}`;
    });
  });

  // ── Dropdown Toggle ─────────────────────────────────────────────
  container.querySelectorAll('.btn-dropdown-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close all other dropdowns
      container.querySelectorAll('.dropdown-menu').forEach(m => m.classList.add('hidden'));
      const menu = btn.nextElementSibling;
      if (menu) menu.classList.toggle('hidden');
    });
  });
  // Close dropdowns on outside click
  document.addEventListener('click', () => {
    container.querySelectorAll('.dropdown-menu').forEach(m => m.classList.add('hidden'));
  });
  // Prevent dropdown menu clicks from closing via parent
  container.querySelectorAll('.dropdown-menu').forEach(m => {
    m.addEventListener('click', (e) => e.stopPropagation());
  });

  // ── Acknowledge + ETA buttons inside dropdown ─────────────────
  container.querySelectorAll('.btn-acknowledge').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const reqName = btn.getAttribute('data-req-name') || t('dashboard.thisRequest');
      currentReqId = btn.getAttribute('data-req-id') || '';
      openEtaModal(reqName);
    });
  });
  container.querySelectorAll('.btn-edit-eta').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const reqName = btn.getAttribute('data-req-name') || t('dashboard.thisRequest');
      currentReqId = btn.getAttribute('data-req-id') || '';
      // Pre-fill existing eta_date from raw data
      const rawReqs = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
      const raw = rawReqs.find(r => r.id === currentReqId) || {};
      openEtaModal(reqName, raw.eta_date || '');
    });
  });

  // ── Detail Modal ────────────────────────────────────────────────
  const detailModal = container.querySelector('#detail-modal');
  const closeDetailModal = () => {
    detailModal?.classList.add('hidden');
    document.body.style.overflow = '';
  };
  container.querySelector('#detail-modal-close')?.addEventListener('click', closeDetailModal);
  container.querySelector('#detail-modal-backdrop')?.addEventListener('click', closeDetailModal);

  container.querySelectorAll('.btn-view-detail').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const reqId = btn.getAttribute('data-req-id') || '';
      // Use enriched pending data from module cache (with employee info already populated)
      const raw = _lastPendingData.find(r => String(r.id) === String(reqId)) || {};

      // Helper to set field text, returns true if value is present
      const setField = (id, val) => {
        const el = container.querySelector(`#${id}`);
        if (!el) return;
        const v = val || '';
        el.textContent = v || '-';
        el.closest('.bg-surface-container')?.classList.toggle('ring-1', !v);
        el.closest('.bg-surface-container')?.classList.toggle('ring-amber-400', !v);
      };

      // Employee info — use enriched pending data
      setField('dt-emp-name',   raw.full_name || raw.name || '');
      setField('dt-emp-id',     raw.emp_id || '');
      setField('dt-dept',       raw.department || '');
      setField('dt-position',   raw.position || '');
      setField('dt-phone',      raw.phone || '');
      setField('dt-start-date', raw.start_date || '');
      setField('dt-company',    raw.company_name || '');

      // Request details
      setField('dt-doc-type',   raw.type || raw.doc_type || '');
      setField('dt-purpose',    raw.purpose || '');
      setField('dt-language',   raw.language || '');
      setField('dt-salary',     raw.salary || '');
      const deliveryValue = raw.delivery_value || raw.delivery || '';
      setField('dt-delivery',   raw.delivery || '');
      setField('dt-pickup',     raw.pickup_location || (!deliveryValue.includes('physical') ? 'ไม่ระบุ (ไม่ใช่การรับที่สำนักงาน)' : ''));
      setField('dt-date',       raw.date || '');
      setField('dt-hr-officer', raw.hr_officer || '');

      // Notes
      const notesEl = container.querySelector('#dt-notes');
      if (notesEl) {
        const notesVal = (raw.notes || '').trim();
        notesEl.textContent = notesVal || '-';
      }

      // Issue section
      const issueSection = container.querySelector('#dt-issue-section');
      const snap = raw.cert_issue_snapshot || (raw.request_data?.cert_issue_snapshot) || null;
      if (issueSection) {
        if (raw.cert_ready && (snap || raw.cert_number)) {
          issueSection.classList.remove('hidden');
          const issuedHrbp = snap?.hr_officer_name || raw.hr_officer || '-';
          const requestHrbp = snap?.request_hr_officer_name || raw.hr_officer || '';
          setField('dt-issue-cert-no', snap?.cert_number || raw.cert_number || '');
          setField('dt-issue-date', snap?.cert_issued_date || raw.cert_issued_date || '');
          setField('dt-issue-template', snap?.cert_template_name || raw.cert_template_name || '');
          setField('dt-issue-hrbp', issuedHrbp);
          const contactEl = container.querySelector('#dt-issue-hrbp-contact');
          if (contactEl) {
            const phone = snap?.hr_officer_phone || raw.hr_officer_phone || '';
            const email = snap?.hr_officer_email || raw.hr_officer_email || '';
            contactEl.textContent = [phone && `โทร. ${phone}`, email && `E-mail: ${email}`].filter(Boolean).join(' · ') || '-';
          }
          const signerEl = container.querySelector('#dt-issue-signer');
          if (signerEl) {
            const sName = snap?.hr_signer_name || raw.hr_signer_name || '';
            const sPos = snap?.hr_signer_position || raw.hr_signer_position || '';
            signerEl.textContent = sName ? `${sName}${sPos ? ` (${sPos})` : ''}` : '-';
          }
          setField('dt-issue-remark', snap?.hr_purpose_detail || raw.hr_purpose_detail || '');
          setField('dt-issue-by', snap?.issued_by_name || '-');
          const savedAtEl = container.querySelector('#dt-issue-saved-at');
          if (savedAtEl && snap?.saved_at) {
            const d = new Date(snap.saved_at);
            savedAtEl.textContent = Number.isNaN(d.getTime()) ? snap.saved_at : d.toLocaleString('th-TH');
          } else if (savedAtEl) {
            savedAtEl.textContent = raw.cert_issued_date || '-';
          }

          const mismatchEl = container.querySelector('#dt-issue-mismatch');
          if (mismatchEl) {
            if (requestHrbp && issuedHrbp && requestHrbp !== issuedHrbp) {
              mismatchEl.textContent = t('dashboard.issueHrbpMismatch', { request: requestHrbp, issued: issuedHrbp });
              mismatchEl.classList.remove('hidden');
            } else {
              mismatchEl.classList.add('hidden');
            }
          }
        } else {
          issueSection.classList.add('hidden');
        }
      }

      // Delivery status (physical only)
      const deliveryStatusSection = container.querySelector('#dt-delivery-status-section');
      if (deliveryStatusSection) {
        const hasPhysical = deliveryValue.includes('physical');
        if (hasPhysical) {
          deliveryStatusSection.classList.remove('hidden');
          const isDelivered = raw.physical_delivered || false;
          const statusEl = container.querySelector('#dt-delivery-status-value');
          const pickupEl = container.querySelector('#dt-delivery-pickup');
          const btnEl = container.querySelector('#btn-mark-delivered');
          if (statusEl) {
            statusEl.textContent = isDelivered ? t('dashboard.deliverySent') : t('dashboard.deliveryPending');
            statusEl.classList.toggle('text-green-700', isDelivered);
            statusEl.classList.toggle('text-amber-700', !isDelivered);
          }
          if (pickupEl) {
            pickupEl.textContent = raw.pickup_location || '-';
          }
          if (btnEl) {
            btnEl.classList.toggle('hidden', isDelivered);
            btnEl.onclick = async () => {
              btnEl.disabled = true;
              try {
                await fetch(`${apiBase}/api/requests/${raw.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('hrbp_token') || '') },
                  body: JSON.stringify({ physical_delivered: true })
                });
                showToast(t('dashboard.markDeliveredSuccess'), 'success');
                refreshDashboard();
              } catch (e) {
                showToast('Error: ' + e.message, 'error');
              } finally {
                btnEl.disabled = false;
              }
            };
          }
        } else {
          deliveryStatusSection.classList.add('hidden');
        }
      }

      // Attachments
      const attachEl = container.querySelector('#dt-attachments');
      if (attachEl) {
        const files = raw.attachments || [];
        if (files.length > 0) {
          attachEl.innerHTML = files.map(f => `<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-fixed/20 text-primary rounded-lg text-label-xs font-semibold"><span class="material-symbols-outlined text-[14px]">attach_file</span>${f.name || f.key || 'ไฟล์แนบ'}</span>`).join('');
        } else {
          attachEl.innerHTML = '<span class="text-label-xs text-outline">ไม่มีไฟล์แนบ</span>';
        }
      }

      // Compute missing fields — use enriched data
      const missingFields = [];
      if (!raw.emp_id)                   missingFields.push('รหัสพนักงาน');
      if (!raw.position)                 missingFields.push('ตำแหน่งงาน');
      if (!raw.department)               missingFields.push('แผนก');
      if (!raw.start_date)               missingFields.push('วันที่เริ่มงาน');
      if (!raw.phone)                    missingFields.push('เบอร์โทรศัพท์');
      if (!raw.purpose)                  missingFields.push('วัตถุประสงค์ในการขอ');
      if (!raw.language)                 missingFields.push('ภาษาที่ต้องการ');
      if (!raw.delivery)                 missingFields.push('วิธีการรับเอกสาร');
      if (!raw.hr_officer)               missingFields.push('เจ้าหน้าที่ HR ที่เลือก');

      const banner = container.querySelector('#dt-missing-banner');
      const missingList = container.querySelector('#dt-missing-list');
      if (banner && missingList) {
        if (missingFields.length > 0) {
          missingList.innerHTML = missingFields.map(f => `<li>${f}</li>`).join('');
          banner.classList.remove('hidden');
        } else {
          banner.classList.add('hidden');
        }
      }

      detailModal?.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    });
  });

  // ── Pagination ─────────────────────────────────────────────────
  container.querySelectorAll('.btn-page').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.getAttribute('data-page'));
      if (page < 1) return;
      sessionStorage.setItem('dashboard-pending-page', String(page));
      refreshDashboard();
    });
  });

  // ── KPI Click Filter ──────────────────────────────────────────
  container.querySelectorAll('.kpi-card').forEach(card => {
    card.addEventListener('click', () => {
      const val = card.getAttribute('data-filter-value');
      const current = sessionStorage.getItem('dashboard-pending-filter') || '';
      sessionStorage.setItem('dashboard-pending-page', '1');
      sessionStorage.setItem('dashboard-pending-filter', val === current ? '' : val);
      refreshDashboard();
    });
  });

  // ── Chart Period ────────────────────────────────────────────────
  container.querySelectorAll('.btn-chart-period').forEach(btn => {
    btn.addEventListener('click', () => {
      sessionStorage.setItem('dashboard-chart-period', btn.getAttribute('data-period'));
      refreshDashboard();
    });
  });

  // ── CSV Export ──────────────────────────────────────────────────
  const exportBtn = container.querySelector('#btn-export-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      exportBtn.disabled = true;
      try {
        const data = await getEmployeeRequests({ page: 1, limit: 100, search: '', status: '' });
        const { pending } = computeDashboardData(data);
        const filtered = filterDashboardPending(pending, getDashboardFilterStatus());
        if (!filtered.length) {
          showToast(t('dashboard.csvNoData'), 'info');
          return;
        }
        const csv = buildDashboardCsv(filtered);
        const filterSlug = getDashboardFilterStatus() || 'all';
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pending-requests-${filterSlug}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(t('dashboard.csvExportSuccess', { count: filtered.length }), 'check_circle');
      } catch (err) {
        showToast(t('common.error') + ': ' + (err.message || ''), 'error');
      } finally {
        exportBtn.disabled = false;
      }
    });
  }
}
