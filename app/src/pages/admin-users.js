/**
 * Admin: User Management Page
 * Migrated from _1/code.html
 */
import { getUsers, updateUser, getBusinessUnits } from '../lib/api.js';
import { loadAvatarForElement } from '../lib/avatar-helper.js';
import { t } from '../lib/i18n.js';
import { getRoleBadgeClass, getRoleLabel, syncCurrentUserFromList } from '../lib/role-helper.js';
import { setCurrentUser } from '../mock-data.js';

function renderUserAvatar(user) {
  const initials = (user.full_name || user.username || 'US')
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const avatarUrl = user.avatar_url;

  if (avatarUrl) {
    return `<img src="${avatarUrl}" alt="User profile" class="w-10 h-10 rounded-full object-cover shadow-sm" onerror="this.onerror=null; this.outerHTML=\`<div class='w-10 h-10 rounded-full bg-secondary-fixed text-primary flex items-center justify-center font-bold text-label-md shadow-sm'>${initials}</div>\`;" />`;
  }

  if (user.emp_id) {
    return `<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-avatar-emp-id="${user.emp_id}" alt="User profile" class="w-10 h-10 rounded-full object-cover shadow-sm" onerror="this.onerror=null; this.outerHTML=\`<div class='w-10 h-10 rounded-full bg-secondary-fixed text-primary flex items-center justify-center font-bold text-label-md shadow-sm'>${initials}</div>\`;" />`;
  }

  return `
    <div class="w-10 h-10 rounded-full bg-secondary-fixed text-primary flex items-center justify-center font-bold text-label-md shadow-sm">
      ${initials}
    </div>
  `;
}

function renderRoleBadge(role) {
  return `<span class="inline-flex items-center px-2 py-0.5 rounded text-label-xs font-bold ${getRoleBadgeClass(role)}">${getRoleLabel(role)}</span>`;
}

function renderStatusBadge(status) {
  const isActive = !status || status === 'active';
  if (isActive) {
    return `<div class="flex items-center gap-1.5 text-green-600"><span class="w-2 h-2 rounded-full bg-green-600"></span><span class="text-label-sm">Active</span></div>`;
  }
  return `<div class="flex items-center gap-1.5 text-on-surface-variant"><span class="w-2 h-2 rounded-full bg-outline"></span><span class="text-label-sm">Inactive</span></div>`;
}

export function renderAdminUsers() {
  return `
    <!-- Header Section -->
    <div class="mb-8">
      <h2 class="page-title">${t('users.pageTitle')}</h2>
      <p class="page-subtitle">${t('users.pageSubtitle')}</p>
    </div>

    <!-- Summary Metrics Bento-ish Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="tonal-card p-6 border-l-4 border-primary">
        <div class="flex justify-between items-start gap-4">
          <div>
            <p class="text-on-surface-variant text-label-md whitespace-nowrap">${t('users.totalUsers')}</p>
            <h3 id="metric-total-users" class="text-display font-display mt-2">-</h3>
          </div>
          <div class="bg-primary-fixed p-2 rounded-lg text-primary shrink-0">
            <span class="material-symbols-outlined">group</span>
          </div>
        </div>
      </div>
      <div class="tonal-card p-6 border-l-4 border-secondary">
        <div class="flex justify-between items-start gap-4">
          <div>
            <p class="text-on-surface-variant text-label-md whitespace-nowrap">${t('users.totalAdmins')}</p>
            <h3 id="metric-hr-users" class="text-display font-display mt-2">-</h3>
          </div>
          <div class="bg-secondary-fixed p-2 rounded-lg text-on-secondary-container shrink-0">
            <span class="material-symbols-outlined">shield_person</span>
          </div>
        </div>
        <p id="metric-hr-breakdown" class="mt-4 text-label-sm text-on-surface-variant">-</p>
      </div>
      <div class="tonal-card p-6 border-l-4 border-tertiary">
        <div class="flex justify-between items-start gap-4">
          <div>
            <p class="text-on-surface-variant text-label-md whitespace-nowrap">${t('users.totalEmployees')}</p>
            <h3 id="metric-employee-users" class="text-display font-display mt-2">-</h3>
          </div>
          <div class="bg-tertiary-fixed p-2 rounded-lg text-on-tertiary-container shrink-0">
            <span class="material-symbols-outlined">badge</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Filter and Table Card -->
    <div class="tonal-card overflow-hidden">
      <div class="p-6 border-b border-outline-variant flex flex-col md:flex-row gap-4 items-center">
        <div class="flex-1 w-full">
          <div class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">filter_list</span>
            <input id="user-search-input" class="w-full bg-surface border border-outline-variant rounded-lg pl-10 pr-4 py-2.5 text-body-md focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all" placeholder="${t('users.searchPlaceholder')}" type="text" />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <label class="flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded-lg border border-outline-variant bg-surface hover:bg-surface-container-low transition-colors">
            <input id="user-show-inactive" type="checkbox" class="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20" />
            <span class="text-label-md text-on-surface-variant whitespace-nowrap">${t('users.showInactive')}</span>
          </label>
          <select id="user-role-filter" class="bg-surface border border-outline-variant rounded-lg px-4 py-2.5 text-label-md text-on-surface-variant focus:ring-2 focus:ring-primary/10">
            <option value="all">${t('users.roleAll')}</option>
            <option value="admin">Admin</option>
            <option value="hrmanager">HR Manager</option>
            <option value="hrbp">HRBP</option>
            <option value="employee">Employee</option>
          </select>
        </div>
      </div>
      <div class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left border-collapse">
          <thead class="bg-surface-container-low">
            <tr>
              <th class="px-6 py-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">${t('users.tableName')}</th>
              <th class="px-6 py-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">${t('users.tableEmpCode')}</th>
              <th class="px-6 py-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">${t('users.tableDept')}</th>
              <th class="px-6 py-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">${t('users.tablePhone')}</th>
              <th class="px-6 py-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">${t('users.tableRole')}</th>
              <th class="px-6 py-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">Responsible BU</th>
              <th class="px-6 py-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">${t('users.tableStatus')}</th>
              <th class="px-6 py-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider text-right">${t('users.tableAction')}</th>
            </tr>
          </thead>
          <tbody id="admin-users-tbody" class="divide-y divide-outline-variant">
            <tr>
              <td colspan="8" class="px-6 py-12 text-center text-on-surface-variant font-medium">
                <div class="flex items-center justify-center gap-2">
                  <span class="material-symbols-outlined animate-spin text-[20px] text-primary">sync</span>
                  <span>${t('users.loadingUsers')}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Pagination -->
      <div class="p-6 border-t border-outline-variant flex flex-col sm:flex-row justify-between items-center gap-4">
        <p id="pagination-info" class="text-label-sm text-on-surface-variant">${t('users.loadingPagination')}</p>
        <div class="flex items-center gap-2">
          <button class="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container-low disabled:opacity-50 transition-all" disabled>
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <button class="w-10 h-10 flex items-center justify-center rounded-lg bg-primary text-on-primary text-label-md font-bold">1</button>
          <button class="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-container-low disabled:opacity-50 transition-all" disabled>
            <span class="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div id="edit-user-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 hidden">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="edit-modal-backdrop"></div>
      <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        <div class="h-1.5 bg-primary w-full"></div>
        <div class="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 class="text-title-md font-bold text-on-surface">${t('users.editModalTitle')}</h3>
          <button id="edit-modal-close" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-outline transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <form id="edit-user-form" class="p-6 space-y-4">
          <input type="hidden" id="edit-user-id" />
          <div>
            <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('users.editNameLabel')}</label>
            <input type="text" id="edit-user-name" readonly class="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface outline-none" />
          </div>
          <div>
            <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('users.editRoleLabel')}</label>
            <select id="edit-user-role" class="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface focus:border-primary outline-none">
              <option value="employee">${t('users.editRoleEmp')}</option>
              <option value="hrbp">${t('users.editRoleHrbp')}</option>
              <option value="hrmanager">HR Manager</option>
              <option value="admin">${t('users.editRoleAdmin')}</option>
            </select>
          </div>
          <div>
            <label class="block text-label-sm font-semibold text-on-surface-variant mb-1">${t('users.editStatusLabel')}</label>
            <select id="edit-user-status" class="w-full bg-white border border-outline-variant rounded-xl px-4 py-2.5 text-body-md text-on-surface focus:border-primary outline-none">
              <option value="active">${t('users.editStatusActive')}</option>
              <option value="inactive">${t('users.editStatusInactive')}</option>
            </select>
          </div>
          <div>
            <label class="block text-label-sm font-semibold text-on-surface-variant mb-2">${t('users.editBuLabel')}</label>
            <div id="edit-user-bu-container" class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-3 border border-outline-variant bg-surface-container-lowest rounded-xl">
              <p class="text-label-sm text-outline col-span-full">${t('users.buLoading')}</p>
            </div>
            <p class="text-[11px] text-outline mt-1">${t('users.editBuHint')}</p>
          </div>
          <div class="flex gap-3 pt-4">
            <button type="button" id="edit-modal-cancel" class="flex-1 py-3 border border-outline-variant text-on-surface-variant hover:bg-surface-container rounded-xl font-bold transition-all">${t('common.cancel')}</button>
            <button type="submit" id="edit-save-btn" class="flex-1 py-3 bg-primary text-on-primary hover:opacity-90 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2"><span class="btn-text">${t('common.save')}</span><span class="material-symbols-outlined btn-icon text-[18px]">save</span></button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export async function initAdminUsers(container) {
  const tbody = container.querySelector('#admin-users-tbody');
  const searchInput = container.querySelector('#user-search-input');
  const roleFilter = container.querySelector('#user-role-filter');
  const totalUsersMetric = container.querySelector('#metric-total-users');
  const hrUsersMetric = container.querySelector('#metric-hr-users');
  const hrBreakdownMetric = container.querySelector('#metric-hr-breakdown');
  const employeeUsersMetric = container.querySelector('#metric-employee-users');
  const showInactiveToggle = container.querySelector('#user-show-inactive');
  const paginationInfo = container.querySelector('#pagination-info');

  const SHOW_INACTIVE_KEY = 'users-show-inactive';
  let showInactive = sessionStorage.getItem(SHOW_INACTIVE_KEY) === 'true';
  if (showInactiveToggle) showInactiveToggle.checked = showInactive;

  // Edit Modal
  const editModal = container.querySelector('#edit-user-modal');
  const editForm = container.querySelector('#edit-user-form');
  const editUserId = container.querySelector('#edit-user-id');
  const editUserName = container.querySelector('#edit-user-name');
  const editUserRole = container.querySelector('#edit-user-role');
  const editUserStatus = container.querySelector('#edit-user-status');
  const buContainer = container.querySelector('#edit-user-bu-container');
  const editCancel = container.querySelector('#edit-modal-cancel');
  const editClose = container.querySelector('#edit-modal-close');
  const editBackdrop = container.querySelector('#edit-modal-backdrop');
  const editSaveBtn = container.querySelector('#edit-save-btn');

  let allUsers = [];
  let availableBUs = [];

  // ── Helpers ──────────────────────────────────────────────────
  const setLoading = (btn, isLoading, defaultText, defaultIcon) => {
    if (!btn) return;
    const textEl = btn.querySelector('.btn-text');
    const iconEl = btn.querySelector('.btn-icon');
    btn.disabled = isLoading;
    btn.classList.toggle('opacity-70', isLoading);
    if (textEl) textEl.textContent = isLoading ? t('users.saving') : defaultText;
    if (iconEl) iconEl.textContent = isLoading ? 'hourglass_empty' : defaultIcon;
  };

  const showToast = (message, icon = 'check_circle', iconClass = 'text-green-600') => {
    const toast = document.createElement('div');
    toast.className = 'fixed inset-0 z-[200] flex items-center justify-center';
    toast.innerHTML = `<div class="absolute inset-0 bg-black/30"></div><div class="relative flex flex-col items-center gap-3 bg-surface-container-high border border-outline-variant px-8 py-6 rounded-2xl shadow-2xl text-label-md font-bold min-w-[300px] max-w-sm animate-[fadeIn_0.2s_ease-out]"><span class="material-symbols-outlined ${iconClass} text-[36px]">${icon}</span><span class="text-on-surface text-center">${message}</span></div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const HR_ROLES = ['admin', 'hrmanager', 'hrbp'];
  const isActive = (u) => !u.status || u.status === 'active';
  const getScopedUsers = () => (showInactive ? allUsers : allUsers.filter(isActive));

  const updateMetrics = () => {
    const pool = getScopedUsers();
    const adminCount = pool.filter(u => u.role === 'admin').length;
    const hrmanagerCount = pool.filter(u => u.role === 'hrmanager').length;
    const hrbpCount = pool.filter(u => u.role === 'hrbp').length;
    const hrTotalCount = pool.filter(u => HR_ROLES.includes(u.role)).length;
    const employeeCount = pool.filter(u => u.role === 'employee').length;

    if (totalUsersMetric) totalUsersMetric.textContent = pool.length.toLocaleString();
    if (hrUsersMetric) hrUsersMetric.textContent = hrTotalCount.toLocaleString();
    if (employeeUsersMetric) employeeUsersMetric.textContent = employeeCount.toLocaleString();
    if (hrBreakdownMetric) {
      hrBreakdownMetric.textContent = t('users.hrRoleBreakdown', {
        admin: adminCount,
        hrmanager: hrmanagerCount,
        hrbp: hrbpCount,
      });
    }
  };

  // ── Load BUs ─────────────────────────────────────────────────
  const loadBUs = async () => {
    try {
      const result = await getBusinessUnits();
      if (result.data) {
        availableBUs = result.data.map(d => d.name);
      } else if (Array.isArray(result)) {
        availableBUs = result.map(d => d.name);
      }
    } catch (err) {
      console.warn('Could not load BUs.', err);
    }
  };

  // ── Edit Modal ───────────────────────────────────────────────
  const openEditModal = (user) => {
    if (!editModal) return;
    editUserId.value = user.id;
    editUserName.value = user.full_name || user.username || '-';
    editUserRole.value = user.role || 'employee';
    if (editUserStatus) editUserStatus.value = user.status || 'active';
    const userBUs = Array.isArray(user.responsible_bu) ? user.responsible_bu : [];
    if (buContainer) {
      if (availableBUs.length === 0) {
        buContainer.innerHTML = `<p class="text-label-sm text-on-surface-variant col-span-full italic">${t('users.noBu')}</p>`;
      } else {
        buContainer.innerHTML = availableBUs.map(buName => `
          <label class="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-surface-container rounded transition-colors">
            <input type="checkbox" name="bu_checkbox" value="${buName}" ${userBUs.includes(buName) ? 'checked' : ''} class="w-4 h-4 text-primary rounded border-outline-variant focus:ring-primary/20" />
            <span class="text-label-sm text-on-surface">${buName}</span>
          </label>
        `).join('');
      }
    }
    editModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

  const closeEditModal = () => {
    editModal?.classList.add('hidden');
    document.body.style.overflow = '';
  };

  editCancel?.addEventListener('click', closeEditModal);
  editClose?.addEventListener('click', closeEditModal);
  editBackdrop?.addEventListener('click', closeEditModal);

  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = parseInt(editUserId.value, 10);
    const updatedRole = editUserRole.value;
    const updatedStatus = editUserStatus?.value || 'active';
    const selectedBUs = [];
    if (buContainer) {
      buContainer.querySelectorAll('input[name="bu_checkbox"]:checked').forEach(cb => selectedBUs.push(cb.value));
    }
    setLoading(editSaveBtn, true, t('common.save'), 'save');
    try {
      await updateUser(userId, { role: updatedRole, responsible_bu: selectedBUs, status: updatedStatus });
      allUsers = allUsers.map(u => u.id === userId ? { ...u, role: updatedRole, responsible_bu: selectedBUs, status: updatedStatus } : u);
      if (syncCurrentUserFromList(allUsers)) {
        const synced = JSON.parse(localStorage.getItem('hrbp_user') || 'null');
        if (synced) setCurrentUser(synced);
        window.dispatchEvent(new Event('hashchange'));
      }
      updateMetrics();
      filterAndRender();
      closeEditModal();
      showToast(t('users.saveSuccess'), 'check_circle', 'text-green-600');
    } catch (err) {
      console.error('Error updating user:', err);
      alert(t('users.saveError', { msg: err.message }));
    } finally {
      setLoading(editSaveBtn, false, t('common.save'), 'save');
    }
  });

  // ── Render Table ─────────────────────────────────────────────
  const renderTable = (users) => {
    if (!tbody) return;
    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-8 text-center text-on-surface-variant font-medium">${t('users.emptyTable')}</td></tr>`;
      if (paginationInfo) paginationInfo.textContent = t('users.pagination', { start: 0, end: 0, total: 0 });
      return;
    }

    tbody.innerHTML = users.map(user => {
      const buDisplay = Array.isArray(user.responsible_bu) && user.responsible_bu.length > 0
        ? user.responsible_bu.map(b => `<span class="inline-block px-2 py-0.5 bg-primary-fixed/20 text-primary text-xs rounded border border-primary/10 mr-1 mb-1 font-semibold">${b}</span>`).join('')
        : '<span class="text-label-sm text-outline italic">-</span>';
      return `
        <tr class="hover:bg-surface-container-low transition-colors">
          <td class="px-6 py-4">
            <div class="flex items-center gap-3">
              ${renderUserAvatar(user)}
              <div>
                <p class="text-label-md font-bold text-on-surface">${user.full_name || user.username || '-'}</p>
                <p class="text-label-sm text-on-surface-variant">${user.email || '-'}</p>
              </div>
            </div>
          </td>
          <td class="px-6 py-4 text-label-sm text-on-surface-variant">${user.emp_id || '-'}</td>
          <td class="px-6 py-4 text-label-sm text-on-surface-variant">${user.department || '-'}</td>
          <td class="px-6 py-4 text-label-sm text-on-surface-variant">${user.phone || '-'}</td>
          <td class="px-6 py-4 text-label-sm">${renderRoleBadge(user.role)}</td>
          <td class="px-6 py-4 text-label-sm">${buDisplay}</td>
          <td class="px-6 py-4">${renderStatusBadge(user.status)}</td>
          <td class="px-6 py-4 text-right">
            <button class="edit-user-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high text-on-surface hover:bg-primary hover:text-on-primary rounded-lg text-label-sm font-bold transition-all" data-user-id="${user.id}">
              <span class="material-symbols-outlined text-[16px]">manage_accounts</span>
              <span>${t('common.manage')}</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Wire up "จัดการ" buttons
    tbody.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const uId = parseInt(btn.getAttribute('data-user-id'), 10);
        const user = allUsers.find(u => u.id === uId);
        if (user) openEditModal(user);
      });
    });

    tbody.querySelectorAll('img[data-avatar-emp-id]').forEach(img => {
      loadAvatarForElement(img, img.getAttribute('data-avatar-emp-id'));
    });

    if (paginationInfo) paginationInfo.textContent = t('users.pagination', { start: 1, end: users.length, total: users.length });
  };

  const filterAndRender = () => {
    const query = searchInput?.value.toLowerCase().trim() || '';
    const selectedRole = roleFilter?.value || 'all';
    const filtered = getScopedUsers().filter(user => {
      const matchesSearch = !query ||
        (user.full_name || '').toLowerCase().includes(query) ||
        (user.username || '').toLowerCase().includes(query) ||
        (user.email || '').toLowerCase().includes(query) ||
        (user.emp_id || '').toLowerCase().includes(query) ||
        (user.department || '').toLowerCase().includes(query);
      const matchesRole = selectedRole === 'all' || user.role === selectedRole;
      return matchesSearch && matchesRole;
    });
    renderTable(filtered);
  };

  // ── Load Data ────────────────────────────────────────────────
  try {
    await loadBUs();
    const result = await getUsers();
    allUsers = result.users || [];
    if (syncCurrentUserFromList(allUsers)) {
      const synced = JSON.parse(localStorage.getItem('hrbp_user') || 'null');
      if (synced) setCurrentUser(synced);
      window.dispatchEvent(new Event('hashchange'));
    }
    updateMetrics();
    filterAndRender();
    searchInput?.addEventListener('input', filterAndRender);
    roleFilter?.addEventListener('change', filterAndRender);
    showInactiveToggle?.addEventListener('change', e => {
      showInactive = e.target.checked;
      sessionStorage.setItem(SHOW_INACTIVE_KEY, showInactive ? 'true' : 'false');
      updateMetrics();
      filterAndRender();
    });
  } catch (err) {
    console.error('Error loading admin users:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-8 text-center text-error font-medium">${t('error.loadData')}: ${err.message}</td></tr>`;
    }
    if (paginationInfo) paginationInfo.textContent = t('error.loadDataFail');
  }
}
