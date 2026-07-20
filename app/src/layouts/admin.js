import { getUsers } from '../lib/api.js';
import { attachNavigation, getCurrentRoute } from '../router.js';
import { getCurrentUser, logout, setCurrentUser } from '../mock-data.js';
import { syncCurrentUserFromList } from '../lib/role-helper.js';
import { navigate } from '../router.js';
import { loadAvatarForElement } from '../lib/avatar-helper.js';
import { t, renderLangSwitcher, initLangSwitcher } from '../lib/i18n.js';
import { getRoleLabel } from '../lib/role-helper.js';

const adminMenuItems = [
  { icon: 'home', labelKey: 'nav.requests', route: '/admin/requests', roles: ['admin', 'hrmanager', 'hrbp'] },
  { icon: 'dashboard', labelKey: 'nav.dashboard', route: '/admin/dashboard', roles: ['admin', 'hrmanager', 'hrbp'] },
  { icon: 'description', labelKey: 'nav.templates', route: '/admin/templates', roles: ['admin', 'hrmanager', 'hrbp'] },
  { icon: 'manage_accounts', labelKey: 'nav.users', route: '/admin/users', roles: ['admin', 'hrmanager', 'hrbp'] },
  { icon: 'settings', labelKey: 'nav.settings', route: '/admin/settings', roles: ['admin', 'hrmanager', 'hrbp'] },
];

export function renderAdminLayout(contentHTML) {
  const user = getCurrentUser();
  const empId = user?.emp_id || user?.empCode;
  const avatarUrl = user?.avatar_url;
  const currentPath = getCurrentRoute();
  const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';

  return `
    <div class="flex min-h-screen overflow-x-hidden">
      <!-- Sidebar -->
      <aside id="sidebar" class="hidden md:flex flex-col h-screen fixed left-0 top-0 pb-8 bg-surface-container-low border-r border-outline-variant z-50 transition-all duration-300 ${isCollapsed ? 'w-20 px-2 pt-4' : 'w-64 px-4 pt-6'}">
        <!-- Sidebar Header / Brand -->
        <div class="flex items-center justify-between mb-6 px-2">
          <div class="flex items-center gap-3" id="sidebar-brand">
            <span class="material-symbols-outlined text-primary text-[28px] shrink-0">corporate_fare</span>
             <span class="text-[18px] font-display text-primary cursor-pointer font-bold ${isCollapsed ? 'hidden' : ''}" data-navigate="/admin/dashboard">HRBP Internal</span>
          </div>
          <button id="sidebar-toggle-btn" class="p-1 rounded-lg hover:bg-surface-container-high text-outline transition-colors flex items-center justify-center shrink-0">
            <span id="sidebar-toggle-icon" class="material-symbols-outlined">${isCollapsed ? 'chevron_right' : 'chevron_left'}</span>
          </button>
        </div>

        <!-- Navigation Links -->
        <nav class="flex-1 flex flex-col gap-1 overflow-y-auto">
          ${adminMenuItems.filter(item => item.roles.includes(user?.role)).map(item => {
            const isActive = currentPath === item.route;
            const label = t(item.labelKey);
            return `
              <a class="flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} ${isActive
                ? 'bg-secondary-container text-on-secondary-container font-bold rounded-lg'
                : 'text-on-surface-variant hover:bg-surface-container-high rounded-lg'} px-4 py-3 transition-all duration-150 cursor-pointer"
                   data-navigate="${item.route}"
                   title="${label}">
                <span class="material-symbols-outlined shrink-0">${item.icon}</span>
                <span class="text-label-md ${isCollapsed ? 'hidden' : ''}">${label}</span>
              </a>
            `;
          }).join('')}
        </nav>

        <!-- User Profile Section -->
        <div class="mt-auto border-t border-outline-variant pt-4 flex flex-col gap-2" id="admin-profile-block">
          <div class="flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-2 px-2">
            <button class="flex items-center gap-3 min-w-0 flex-1 rounded-xl hover:bg-surface-container-high transition-colors p-1 text-left" id="admin-profile-btn" title="${t('nav.myInfo')}">
              ${avatarUrl ? 
                `<img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover border border-outline-variant shrink-0" onerror="this.onerror=null; this.outerHTML=\`<div class='w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container border border-outline-variant shrink-0'><span class='material-symbols-outlined'>person</span></div>\`;" />` :
                (empId ? 
                  `<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-avatar-emp-id="${empId}" class="w-10 h-10 rounded-full object-cover border border-outline-variant shrink-0" onerror="this.onerror=null; this.outerHTML=\`<div class='w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container border border-outline-variant shrink-0'><span class='material-symbols-outlined'>person</span></div>\`;" />` :
                  `<div class="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container border border-outline-variant shrink-0"><span class="material-symbols-outlined">person</span></div>`
                )
              }
              <div class="text-left min-w-0 ${isCollapsed ? 'hidden' : ''}">
                <p class="text-label-md font-bold text-on-surface truncate">${user?.full_name || user?.nameDisplay || t('nav.roleAdmin')}</p>
                <p class="text-label-sm text-outline truncate">${user?.role ? getRoleLabel(user.role) : '-'}</p>
              </div>
            </button>
            <button class="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-error-container hover:text-on-error-container text-on-surface-variant transition-colors shrink-0 ${isCollapsed ? 'hidden' : ''}" id="admin-logout-btn" title="${t('nav.logout')}">
              <span class="material-symbols-outlined">logout</span>
            </button>
          </div>
          ${renderLangSwitcher()}
      </aside>

      <!-- Main Content Area -->
      <main id="main-content" class="flex-grow p-4 md:p-8 min-h-screen pt-8 pb-20 transition-all duration-300" style="width: ${isCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)'}; margin-left: ${isCollapsed ? '80px' : '256px'};">
        <div class="page-enter">
          ${contentHTML}
        </div>
      </main>
    </div>

    <!-- Admin Profile Info Modal -->
    <div id="admin-profile-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 hidden">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="admin-modal-backdrop"></div>
      <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <!-- Top accent -->
        <div class="h-1.5 bg-primary w-full"></div>
        <!-- Header -->
        <div class="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 class="text-title-md font-bold text-on-surface">${t('nav.myInfo')}</h3>
          <button id="admin-modal-close" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-outline transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <!-- Avatar + name -->
        <div class="flex flex-col items-center gap-2 px-6 pb-4">
          ${avatarUrl ? 
            `<img src="${avatarUrl}" class="w-16 h-16 rounded-full object-cover border-2 border-outline-variant" onerror="this.onerror=null; this.outerHTML=\`<div class='w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container border-2 border-outline-variant'><span class='material-symbols-outlined text-[32px]'>person</span></div>\`;" />` :
            (empId ? 
              `<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-avatar-emp-id="${empId}" class="w-16 h-16 rounded-full object-cover border-2 border-outline-variant" onerror="this.onerror=null; this.outerHTML=\`<div class='w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container border-2 border-outline-variant'><span class='material-symbols-outlined text-[32px]'>person</span></div>\`;" />` :
              `<div class="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container border-2 border-outline-variant"><span class="material-symbols-outlined text-[32px]'>person</span></div>`
            )
          }
          <div class="text-center">
            <p class="text-title-sm font-bold text-on-surface" id="admin-modal-fullname"></p>
            <p class="text-label-md text-primary" id="admin-modal-role"></p>
          </div>
        </div>
        <!-- Info rows -->
        <div class="px-6 pb-6 flex flex-col gap-3">
          <div class="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3">
            <span class="material-symbols-outlined text-outline text-[20px]">badge</span>
            <div class="min-w-0">
              <p class="text-label-xs text-outline">${t('nav.employeeId')}</p>
              <p class="text-label-md font-semibold text-on-surface" id="admin-modal-empid"></p>
            </div>
          </div>
          <div class="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3">
            <span class="material-symbols-outlined text-outline text-[20px]">corporate_fare</span>
            <div class="min-w-0">
              <p class="text-label-xs text-outline">${t('nav.company')}</p>
              <p class="text-label-md font-semibold text-on-surface" id="admin-modal-company"></p>
            </div>
          </div>
          <div class="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3">
            <span class="material-symbols-outlined text-outline text-[20px]">domain</span>
            <div class="min-w-0">
              <p class="text-label-xs text-outline">${t('nav.department')}</p>
              <p class="text-label-md font-semibold text-on-surface" id="admin-modal-department"></p>
            </div>
          </div>
          <div class="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3">
            <span class="material-symbols-outlined text-outline text-[20px]">mail</span>
            <div class="min-w-0">
              <p class="text-label-xs text-outline">${t('nav.email')}</p>
              <p class="text-label-md font-semibold text-on-surface truncate" id="admin-modal-email"></p>
            </div>
          </div>
          <div class="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3">
            <span class="material-symbols-outlined text-outline text-[20px]">phone</span>
            <div class="min-w-0">
              <p class="text-label-xs text-outline">${t('nav.phone')}</p>
              <p class="text-label-md font-semibold text-on-surface" id="admin-modal-phone"></p>
            </div>
          </div>
        </div>
        <!-- Logout at bottom of modal -->
        <div class="px-6 pb-6">
          <button id="admin-modal-logout" class="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-error text-error hover:bg-error-container transition-colors text-label-md font-bold">
            <span class="material-symbols-outlined text-[18px]">logout</span>
            ${t('nav.logout')}
          </button>
        </div>
      </div>
    </div>
  `;
}

export async function initAdminLayout(container) {
  attachNavigation(container);

  try {
    const result = await getUsers();
    const users = result.users || [];
    if (syncCurrentUserFromList(users)) {
      const synced = JSON.parse(localStorage.getItem('hrbp_user') || 'null');
      if (synced) {
        setCurrentUser(synced);
        window.dispatchEvent(new Event('hashchange'));
      }
    }
  } catch (_) {}

  // Load sidebar and modal avatars
  container.querySelectorAll('img[data-avatar-emp-id]').forEach(img => {
    const empId = img.getAttribute('data-avatar-emp-id');
    loadAvatarForElement(img, empId);
  });

  // Logout triggers
  const performLogout = () => {
    if (confirm(t('nav.confirmLogout'))) {
      logout();
      navigate('/login');
    }
  };

  initLangSwitcher(container);

  const logoutBtn = container.querySelector('#admin-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', performLogout);

  // Profile modal
  const profileBtn = container.querySelector('#admin-profile-btn');
  const modal = container.querySelector('#admin-profile-modal');
  const modalClose = container.querySelector('#admin-modal-close');
  const modalBackdrop = container.querySelector('#admin-modal-backdrop');
  const modalLogout = container.querySelector('#admin-modal-logout');

  const openModal = () => {
    const u = getCurrentUser();
    if (!modal || !u) return;
    modal.querySelector('#admin-modal-fullname').textContent = u.full_name || u.nameDisplay || '-';
    modal.querySelector('#admin-modal-role').textContent = u.role ? getRoleLabel(u.role) : '-';
    modal.querySelector('#admin-modal-empid').textContent = u.emp_id || u.empCode || '-';
    modal.querySelector('#admin-modal-company').textContent = u.company_name || '-';
    modal.querySelector('#admin-modal-department').textContent = u.department || '-';
    modal.querySelector('#admin-modal-email').textContent = u.email || '-';
    modal.querySelector('#admin-modal-phone').textContent = u.phone || '-';
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };
  const closeModal = () => {
    modal?.classList.add('hidden');
    document.body.style.overflow = '';
  };

  if (profileBtn) profileBtn.addEventListener('click', openModal);
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
  if (modalLogout) modalLogout.addEventListener('click', () => { closeModal(); performLogout(); });

  const toggleBtn = container.querySelector('#sidebar-toggle-btn');
  const sidebar = container.querySelector('#sidebar');
  const mainContent = container.querySelector('#main-content');
  
  if (toggleBtn && sidebar && mainContent) {
    toggleBtn.addEventListener('click', () => {
      const isCollapsedNow = localStorage.getItem('sidebar-collapsed') === 'true';
      const willCollapse = !isCollapsedNow;
      localStorage.setItem('sidebar-collapsed', String(willCollapse));

      // Directly manipulate DOM for smooth CSS transitions (no page re-render)
      if (willCollapse) {
        // Collapse sidebar
        sidebar.classList.remove('w-64', 'px-4', 'pt-6');
        sidebar.classList.add('w-20', 'px-2', 'pt-4');
        mainContent.style.width = 'calc(100% - 80px)';
        mainContent.style.marginLeft = '80px';
        // Hide text labels
        sidebar.querySelectorAll('.text-label-md, .text-label-sm').forEach(el => el.classList.add('hidden'));
        sidebar.querySelectorAll('#sidebar-brand span[class*="text-["]').forEach(el => el.classList.add('hidden'));
        // Change icon to chevron_right
        const icon = sidebar.querySelector('#sidebar-toggle-icon');
        if (icon) icon.textContent = 'chevron_right';
        // Center nav links
        sidebar.querySelectorAll('nav a').forEach(a => {
          a.classList.remove('gap-3');
          a.classList.add('justify-center');
        });
        // Hide brand text
        const brandText = sidebar.querySelector('#sidebar-brand span:last-child');
        if (brandText) brandText.classList.add('hidden');
        // Hide logout button text & adjust profile
        const profileTextDiv = sidebar.querySelector('#admin-profile-block .text-left');
        if (profileTextDiv) profileTextDiv.classList.add('hidden');
        const logoutBtn = sidebar.querySelector('#admin-logout-btn');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        const profileBlockFlex = sidebar.querySelector('#admin-profile-block > div');
        if (profileBlockFlex) profileBlockFlex.classList.add('justify-center');
      } else {
        // Expand sidebar
        sidebar.classList.remove('w-20', 'px-2', 'pt-4');
        sidebar.classList.add('w-64', 'px-4', 'pt-6');
        mainContent.style.width = 'calc(100% - 256px)';
        mainContent.style.marginLeft = '256px';
        // Show text labels
        sidebar.querySelectorAll('.text-label-md, .text-label-sm').forEach(el => el.classList.remove('hidden'));
        // Change icon to chevron_left
        const icon = sidebar.querySelector('#sidebar-toggle-icon');
        if (icon) icon.textContent = 'chevron_left';
        // Restore nav links
        sidebar.querySelectorAll('nav a').forEach(a => {
          a.classList.add('gap-3');
          a.classList.remove('justify-center');
        });
        // Show brand text
        const brandText = sidebar.querySelector('#sidebar-brand span:last-child');
        if (brandText) brandText.classList.remove('hidden');
        // Show logout button & profile text
        const profileTextDiv = sidebar.querySelector('#admin-profile-block .text-left');
        if (profileTextDiv) profileTextDiv.classList.remove('hidden');
        const logoutBtn = sidebar.querySelector('#admin-logout-btn');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        const profileBlockFlex = sidebar.querySelector('#admin-profile-block > div');
        if (profileBlockFlex) profileBlockFlex.classList.remove('justify-center');
      }
    });
  }
}

