import { t } from './i18n.js';

/** System permission role labels — shared across profile sidebar and user management */
export function getRoleLabel(role) {
  const labels = {
    admin: () => t('users.roleBadgeAdmin'),
    hrmanager: () => t('users.roleBadgeHrmanager'),
    hrbp: () => t('users.roleBadgeHrbp'),
    employee: () => t('users.roleBadgeEmployee'),
  };
  return (labels[role] || labels.employee)();
}

export function getRoleBadgeClass(role) {
  const classes = {
    admin: 'bg-blue-600 text-white',
    hrmanager: 'bg-indigo-600 text-white',
    hrbp: 'bg-purple-600 text-white',
    employee: 'bg-gray-200 text-gray-700',
  };
  return classes[role] || classes.employee;
}

/** Keep logged-in session in sync with the users list after role edits */
export function syncCurrentUserFromList(users = []) {
  const cur = JSON.parse(localStorage.getItem('hrbp_user') || 'null');
  if (!cur || !users.length) return false;

  const fresh = users.find(u =>
    (cur.id != null && String(u.id) === String(cur.id)) ||
    (cur.username && u.username === cur.username) ||
    (cur.emp_id && u.emp_id === cur.emp_id)
  );
  if (!fresh) return false;

  const merged = { ...cur, ...fresh };
  const changed = cur.role !== merged.role
    || cur.full_name !== merged.full_name
    || cur.status !== merged.status;

  if (changed) {
    localStorage.setItem('hrbp_user', JSON.stringify(merged));
    return true;
  }
  return false;
}