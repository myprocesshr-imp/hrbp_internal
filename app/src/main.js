/**
 * Entry Point for HRBP Internal SPA
 */
import { registerRoute, startRouter, navigate } from './router.js';
import { getCurrentUser } from './mock-data.js';
import { getLang } from './lib/i18n.js';

// Layouts
import { renderEmployeeLayout, initEmployeeLayout } from './layouts/employee.js';
import { renderAdminLayout, initAdminLayout } from './layouts/admin.js';

// Pages
import { renderLoginPage, initLoginPage } from './pages/login.js';
import { getEmployeeRequests } from './lib/api.js';
import { renderEmployeeRequests, initEmployeeRequests } from './pages/employee-requests.js';
import { renderNewRequest, initNewRequest } from './pages/employee-new-request.js';
import { renderAdminUsers, initAdminUsers } from './pages/admin-users.js';
import { renderAdminDashboard, initAdminDashboard } from './pages/admin-dashboard.js';
import { renderAdminTemplates, initAdminTemplates } from './pages/admin-templates.js';
import { renderAdminSettings, initAdminSettings } from './pages/admin-settings.js';
import { renderCertificateBuilder, initCertificateBuilder, prefetchTemplates, prefetchHRStaff, prefetchCertMasterData } from './pages/certificate-builder.js';

// Setup Routes
registerRoute('/login', async (appEl) => {
  appEl.innerHTML = renderLoginPage();
  initLoginPage(appEl);
});

// Employee Routes — accessible to ALL logged-in users regardless of role
// Data is filtered by the logged-in user's email (user_id) to show only their own requests
registerRoute('/employee/requests', async (appEl) => {
  if (!checkAuth()) return;  // any logged-in user
  const user = getCurrentUser();
  const page = parseInt(sessionStorage.getItem('requests-page') || '1');
  const search = sessionStorage.getItem('requests-search') || '';
  const status = sessionStorage.getItem('requests-status') || '';
  const result = await getEmployeeRequests({ page, limit: 10, search, status, user_id: user?.email || '' });
  appEl.innerHTML = renderEmployeeLayout(renderEmployeeRequests(result));
  initEmployeeLayout(appEl);
  return initEmployeeRequests(appEl);
});

registerRoute('/employee/new-request', async (appEl) => {
  if (!checkAuth()) return;  // any logged-in user
  appEl.innerHTML = renderEmployeeLayout(renderNewRequest());
  initEmployeeLayout(appEl);
  initNewRequest(appEl);
});

// Admin Routes
registerRoute('/admin/dashboard', async (appEl) => {
  if (!checkAuth(['admin', 'hrmanager', 'hrbp'])) return;
  const data = await getEmployeeRequests({ page: 1, limit: 100, search: '', status: '' });
  appEl.innerHTML = renderAdminLayout(renderAdminDashboard(data));
  initAdminLayout(appEl);
  initAdminDashboard(appEl);
});

registerRoute('/admin/users', async (appEl) => {
  if (!checkAuth(['admin', 'hrmanager', 'hrbp'])) return;
  appEl.innerHTML = renderAdminLayout(renderAdminUsers());
  initAdminLayout(appEl);
  return initAdminUsers(appEl);
});

registerRoute('/admin/templates', async (appEl) => {
  if (!checkAuth(['admin', 'hrmanager', 'hrbp'])) return;
  appEl.innerHTML = renderAdminLayout(renderAdminTemplates());
  initAdminLayout(appEl);
  return initAdminTemplates(appEl);
});

registerRoute('/admin/requests', async (appEl) => {
  if (!checkAuth(['admin', 'hrmanager', 'hrbp'])) return;
  const page = parseInt(sessionStorage.getItem('requests-page') || '1');
  const search = sessionStorage.getItem('requests-search') || '';
  const status = sessionStorage.getItem('requests-status') || '';
  const result = await getEmployeeRequests({ page, limit: 10, search, status });
  appEl.innerHTML = renderAdminLayout(renderEmployeeRequests(result));
  initAdminLayout(appEl);
  return initEmployeeRequests(appEl);
});

registerRoute('/admin/new-request', async (appEl) => {
  if (!checkAuth(['admin', 'hrmanager', 'hrbp'])) return;
  appEl.innerHTML = renderAdminLayout(renderNewRequest());
  initAdminLayout(appEl);
  initNewRequest(appEl);
});

registerRoute('/admin/settings', async (appEl) => {
  if (!checkAuth(['admin', 'hrmanager', 'hrbp'])) return;
  appEl.innerHTML = renderAdminLayout(renderAdminSettings());
  initAdminLayout(appEl);
  initAdminSettings(appEl);
});

const CB_BUILDER_IDS = ['cb-root', 'cb-toolbar', 'cb-sig-panel', 'cb-toast'];

function removeCertificateBuilderDom() {
  CB_BUILDER_IDS.forEach((id) => document.getElementById(id)?.remove());
}

registerRoute('/admin/certificate-builder', async (appEl) => {
  if (!checkAuth(['admin', 'hrmanager', 'hrbp'])) return;
  // Certificate Builder mounts as a full-screen overlay over the layout
  appEl.innerHTML = renderAdminLayout('');
  initAdminLayout(appEl);

  removeCertificateBuilderDom();

  await prefetchTemplates();
  await prefetchHRStaff();
  await prefetchCertMasterData();

  const builderEl = document.createElement('div');
  builderEl.innerHTML = renderCertificateBuilder();
  const builderRoot = builderEl.firstElementChild;
  document.body.appendChild(builderRoot);

  // Hoist fixed chrome to body so stacking/click targets stay above the canvas
  ['cb-toolbar', 'cb-sig-panel', 'cb-toast'].forEach((id) => {
    const el = builderRoot.querySelector(`#${id}`);
    if (el) document.body.appendChild(el);
  });

  const cleanupInner = await initCertificateBuilder(builderRoot);

  return () => {
    if (cleanupInner) cleanupInner();
    removeCertificateBuilderDom();
  };
});

// Auth Guard
function checkAuth(requiredRole) {
  const user = getCurrentUser();
  if (!user) {
    navigate('/login');
    return false;
  }

  const roles = Array.isArray(requiredRole) ? requiredRole : (requiredRole ? [requiredRole] : []);
  if (roles.length > 0 && !roles.includes(user.role)) {
    const isBackendUser = ['admin', 'hrmanager', 'hrbp'].includes(user.role);
    navigate(isBackendUser ? '/admin/dashboard' : '/employee/requests');
    return false;
  }

  return true;
}

// Re-render on language change
window.addEventListener('hrbp-lang-change', () => {
  window.dispatchEvent(new Event('hashchange'));
});

// Start app
document.addEventListener('DOMContentLoaded', () => {
  startRouter();
});
