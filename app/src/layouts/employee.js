import { attachNavigation, getCurrentRoute } from '../router.js';
import { getCurrentUser, logout } from '../mock-data.js';
import { navigate } from '../router.js';
import { loadAvatarForElement } from '../lib/avatar-helper.js';
import { t, renderLangSwitcher, initLangSwitcher } from '../lib/i18n.js';

const employeeMenuSections = [
  {
    headingKey: 'nav.certRequests',
    items: [
      { icon: 'home', labelKey: 'nav.requests', route: '/employee/requests' },
    ],
  },
];

export function renderEmployeeLayout(contentHTML) {
  const user = getCurrentUser();
  const empId = user?.emp_id || user?.empCode;
  const avatarUrl = user?.avatar_url;
  const currentPath = getCurrentRoute();
  const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
  const activeMenuLabel = localStorage.getItem('active-menu-employee') || t('nav.requests');

  return `
    <div class="flex">
      <!-- Sidebar Navigation -->
      <aside id="sidebar" class="hidden md:flex flex-col h-screen fixed left-0 top-0 pb-8 bg-surface-container-low border-r border-outline-variant z-40 transition-all duration-300 ${isCollapsed ? 'w-20 px-2 pt-4' : 'w-64 px-4 pt-6'}">
        <!-- Sidebar Header / Brand -->
        <div class="flex items-center justify-between mb-6 px-2">
          <div class="flex items-center gap-3" id="sidebar-brand">
            <span class="material-symbols-outlined text-primary text-[28px] shrink-0">corporate_fare</span>
             <span class="text-[18px] font-display text-primary cursor-pointer font-bold ${isCollapsed ? 'hidden' : ''}" data-navigate="/employee/requests">HRBP Internal</span>
          </div>
          <button id="sidebar-toggle-btn" class="p-1 rounded-lg hover:bg-surface-container-high text-outline transition-colors flex items-center justify-center shrink-0">
            <span id="sidebar-toggle-icon" class="material-symbols-outlined">${isCollapsed ? 'chevron_right' : 'chevron_left'}</span>
          </button>
        </div>

        <!-- Navigation Links -->
        <nav class="flex flex-col gap-1 flex-grow overflow-y-auto">
          ${employeeMenuSections.map(section => `
            ${section.items.map(item => {
              const label = t(item.labelKey);
              const isActive = activeMenuLabel === label;
              return `
                <a class="flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} ${isActive ? 'bg-secondary-container text-on-secondary-container rounded-lg font-bold' : 'text-on-surface-variant hover:bg-surface-container-high rounded-lg'} px-4 py-3 transition-all duration-150 cursor-pointer"
                   data-navigate="${item.route}"
                   data-menu-label="${label}"
                   title="${label}"
                   ${isActive ? 'style="font-variation-settings: \'FILL\' 1;"' : ''}>
                  <span class="material-symbols-outlined shrink-0" ${isActive ? 'style="font-variation-settings: \'FILL\' 1;"' : ''}>${item.icon}</span>
                  <span class="text-label-md ${isCollapsed ? 'hidden' : ''}">${label}</span>
                </a>
              `;
            }).join('')}
          `).join('')}
        </nav>


        <!-- User Profile Section -->
        <div class="mt-auto border-t border-outline-variant pt-4 flex flex-col gap-2" id="employee-profile-block">
          <div class="flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-2 px-2">
            <button class="flex items-center gap-3 min-w-0 flex-1 rounded-xl hover:bg-surface-container-high transition-colors p-1 text-left" id="employee-profile-btn" title="${t('nav.myInfo')}">
              ${avatarUrl ? 
                `<img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover border border-outline-variant shrink-0" onerror="this.onerror=null; this.outerHTML=\`<div class='w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary border border-outline-variant shrink-0'><span class='material-symbols-outlined'>person</span></div>\`;" />` :
                (empId ? 
                  `<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-avatar-emp-id="${empId}" class="w-10 h-10 rounded-full object-cover border border-outline-variant shrink-0" onerror="this.onerror=null; this.outerHTML=\`<div class='w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary border border-outline-variant shrink-0'><span class='material-symbols-outlined'>person</span></div>\`;" />` :
                  `<div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary border border-outline-variant shrink-0"><span class="material-symbols-outlined">person</span></div>`
                )
              }
              <div class="text-left min-w-0 ${isCollapsed ? 'hidden' : ''}">
                <p class="text-label-md font-bold text-on-surface truncate">${user?.full_name || user?.nameDisplay || t('nav.roleEmployee')}</p>
                <p class="text-label-sm text-outline truncate">${user?.position || user?.roleLabel || t('nav.roleEmployee')}</p>
              </div>
            </button>
            ${['admin', 'hrmanager', 'hrbp'].includes(user?.role) ? `
              <button class="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-primary-container hover:text-on-primary-container text-primary transition-colors shrink-0 ${isCollapsed ? 'hidden' : ''}" id="employee-switch-admin-btn" title="Admin Panel" data-navigate="/admin/dashboard">
                <span class="material-symbols-outlined">shield_person</span>
              </button>
            ` : ''}
            <button class="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-error-container hover:text-on-error-container text-on-surface-variant transition-colors shrink-0 ${isCollapsed ? 'hidden' : ''}" id="employee-logout-btn" title="${t('nav.logout')}">
              <span class="material-symbols-outlined">logout</span>
            </button>
          </div>
          ${renderLangSwitcher()}
      </aside>

      <!-- Main Content Area -->
      <main id="main-content" class="flex-grow p-4 md:p-8 min-h-screen pt-8 pb-20 transition-all duration-300" style="width: ${isCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)'}; margin-left: ${isCollapsed ? '80px' : '256px'}; max-width: 1200px;">
        <div class="page-enter">
          ${contentHTML}
        </div>
      </main>
    </div>

    <!-- Mobile Navigation -->
    <nav class="md:hidden fixed bottom-0 left-0 w-full bg-surface border-t border-outline-variant flex justify-around py-3 z-50 px-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] glass-header">
      ${employeeMenuSections.map(section => section.items.map(item => {
        const label = t(item.labelKey);
        return `
        <a class="flex flex-col items-center gap-1 ${activeMenuLabel === label ? 'text-primary' : 'text-outline'} cursor-pointer" data-navigate="${item.route}" data-menu-label="${label}">
          <span class="material-symbols-outlined" ${activeMenuLabel === label ? 'style="font-variation-settings: \'FILL\' 1;"' : ''}>${item.icon}</span>
          <span class="text-[10px] font-bold">${label}</span>
        </a>`;
      }).join('')).join('')}
      
      <div class="relative -top-8">
        <button class="w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center border-4 border-surface transition-transform hover:scale-105 active:scale-95 cursor-pointer" data-navigate="/employee/new-request">
          <span class="material-symbols-outlined text-[28px]">add</span>
        </button>
      </div>
    </nav>

    <!-- Profile Info Modal -->
    <div id="employee-profile-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 hidden">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="employee-modal-backdrop"></div>
      <div class="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
        <!-- Top accent -->
        <div class="h-1.5 bg-primary w-full"></div>
        <!-- Header -->
        <div class="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 class="text-title-md font-bold text-on-surface">${t('nav.myInfo')}</h3>
          <button id="employee-modal-close" class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-high text-outline transition-colors">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <!-- Avatar + name -->
        <div class="flex flex-col items-center gap-2 px-6 pb-4">
          ${avatarUrl ? 
            `<img src="${avatarUrl}" class="w-16 h-16 rounded-full object-cover border-2 border-outline-variant" onerror="this.onerror=null; this.outerHTML=\`<div class='w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center text-primary border-2 border-outline-variant'><span class='material-symbols-outlined text-[32px]'>person</span></div>\`;" />` :
            (empId ? 
              `<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-avatar-emp-id="${empId}" class="w-16 h-16 rounded-full object-cover border-2 border-outline-variant" onerror="this.onerror=null; this.outerHTML=\`<div class='w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center text-primary border-2 border-outline-variant'><span class='material-symbols-outlined text-[32px]'>person</span></div>\`;" />` :
              `<div class="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center text-primary border-2 border-outline-variant"><span class="material-symbols-outlined text-[32px]">person</span></div>`
            )
          }
          <div class="text-center">
            <p class="text-title-sm font-bold text-on-surface" id="modal-fullname"></p>
            <p class="text-label-md text-primary" id="modal-position"></p>
          </div>
        </div>
        <!-- Info rows -->
        <div class="px-6 pb-6 flex flex-col gap-3">
          <div class="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3">
            <span class="material-symbols-outlined text-outline text-[20px]">badge</span>
            <div class="min-w-0">
              <p class="text-label-xs text-outline">${t('nav.employeeId')}</p>
              <p class="text-label-md font-semibold text-on-surface" id="modal-empid"></p>
            </div>
          </div>
          <div class="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3">
            <span class="material-symbols-outlined text-outline text-[20px]">corporate_fare</span>
            <div class="min-w-0">
              <p class="text-label-xs text-outline">${t('nav.company')}</p>
              <p class="text-label-md font-semibold text-on-surface" id="modal-company"></p>
            </div>
          </div>
          <div class="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3">
            <span class="material-symbols-outlined text-outline text-[20px]">domain</span>
            <div class="min-w-0">
              <p class="text-label-xs text-outline">${t('nav.department')}</p>
              <p class="text-label-md font-semibold text-on-surface" id="modal-department"></p>
            </div>
          </div>
          <div class="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3">
            <span class="material-symbols-outlined text-outline text-[20px]">mail</span>
            <div class="min-w-0">
              <p class="text-label-xs text-outline">${t('nav.email')}</p>
              <p class="text-label-md font-semibold text-on-surface truncate" id="modal-email"></p>
            </div>
          </div>
          <div class="bg-surface-container rounded-xl px-4 py-3 flex items-center gap-3">
            <span class="material-symbols-outlined text-outline text-[20px]">phone</span>
            <div class="min-w-0">
              <p class="text-label-xs text-outline">${t('nav.phone')}</p>
              <p class="text-label-md font-semibold text-on-surface" id="modal-phone"></p>
            </div>
          </div>
        </div>
        <!-- Logout at bottom of modal -->
        <div class="px-6 pb-6">
          <button id="employee-modal-logout" class="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-error text-error hover:bg-error-container transition-colors text-label-md font-bold">
            <span class="material-symbols-outlined text-[18px]">logout</span>
            ${t('nav.logout')}
          </button>
        </div>
      </div>
    </div>
  `;
}

export function initEmployeeLayout(container) {
  attachNavigation(container);

  // Load sidebar and modal avatars
  container.querySelectorAll('img[data-avatar-emp-id]').forEach(img => {
    const empId = img.getAttribute('data-avatar-emp-id');
    loadAvatarForElement(img, empId);
  });

  // Menu click handler
  const menuItems = container.querySelectorAll('[data-menu-label]');
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const label = item.getAttribute('data-menu-label');
      localStorage.setItem('active-menu-employee', label);
      // Force re-render to update the active state immediately
      window.dispatchEvent(new Event('hashchange'));
    });
  });

  // Logout triggers
  const performLogout = () => {
    if (confirm(t('nav.confirmLogout'))) {
      logout();
      navigate('/login');
    }
  };

  initLangSwitcher(container);

  const logoutBtn = container.querySelector('#employee-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', performLogout);

  // Profile modal
  const profileBtn = container.querySelector('#employee-profile-btn');
  const modal = container.querySelector('#employee-profile-modal');
  const modalClose = container.querySelector('#employee-modal-close');
  const modalBackdrop = container.querySelector('#employee-modal-backdrop');
  const modalLogout = container.querySelector('#employee-modal-logout');

  const openModal = () => {
    const u = getCurrentUser();
    if (!modal || !u) return;
    modal.querySelector('#modal-fullname').textContent = u.full_name || u.nameDisplay || '-';
    modal.querySelector('#modal-position').textContent = u.position || u.roleLabel || '-';
    modal.querySelector('#modal-empid').textContent = u.emp_id || u.empCode || '-';
    modal.querySelector('#modal-company').textContent = u.company_name || '-';
    modal.querySelector('#modal-department').textContent = u.department || '-';
    modal.querySelector('#modal-email').textContent = u.email || '-';
    modal.querySelector('#modal-phone').textContent = u.phone || '-';
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

  // Sidebar toggle logic
  const toggleBtn = container.querySelector('#sidebar-toggle-btn');
  const sidebar = container.querySelector('#sidebar');
  const mainContent = container.querySelector('#main-content');
  
  if (toggleBtn && sidebar && mainContent) {
    toggleBtn.addEventListener('click', () => {
      const isCollapsedNow = localStorage.getItem('sidebar-collapsed') === 'true';
      const willCollapse = !isCollapsedNow;
      localStorage.setItem('sidebar-collapsed', String(willCollapse));
      
      // Dispatch a hashchange event to trigger the router to re-render the layout
      window.dispatchEvent(new Event('hashchange'));
    });
  }
}

