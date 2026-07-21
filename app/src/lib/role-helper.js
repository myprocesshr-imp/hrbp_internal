import { t } from './i18n.js';
import { enrichUserFromHrms, persistEnglishNameToMockUsers } from './hrms-helper.js';
import { setCurrentUser } from '../mock-data.js';

/** Read the current English-name fields for a user from the shared mock-users store. */
function readMockUserEnglishFields(user) {
  const users = JSON.parse(localStorage.getItem('hrbp_mock_users') || '[]');
  const rec = users.find(u =>
    (user.id != null && String(u.id) === String(user.id)) ||
    (user.username && u.username === user.username) ||
    (user.emp_id && u.emp_id === user.emp_id)
  );
  if (!rec) return null;
  return {
    fname_e: rec.fname_e || '',
    lname_e: rec.lname_e || '',
    sex_id: rec.sex_id || '',
    full_name_en: rec.full_name_en || '',
  };
}

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

/**
 * Keep logged-in session in sync with the users list after role edits.
 * Also back-fills the English-name fields (fname_e/lname_e/sex_id) for accounts
 * that logged in before those columns existed — sourced from HRMS via
 * enrichUserFromHrms when absent locally.
 *
 * Side effects (all of which feed the views that actually render the names):
 *  - updates localStorage `hrbp_user` and the module-level current user,
 *  - patches the shared `hrbp_mock_users` store (used by getUsers() and the
 *    Certificate Builder HR-staff list),
 *  - persists back to D1 via updateUser (best-effort),
 *  - mutates the matching element of the passed `users` array IN PLACE so the
 *    caller's re-render reflects the change.
 *
 * @returns {Promise<object|false>} the enriched/merged user when something
 *          changed, otherwise false.
 */
export async function syncCurrentUserFromList(users = []) {
  if (!users.length) return false;
  const cur = JSON.parse(localStorage.getItem('hrbp_user') || 'null');
  if (!cur) return false;

  const idx = users.findIndex(u =>
    (cur.id != null && String(u.id) === String(cur.id)) ||
    (cur.username && u.username === cur.username) ||
    (cur.emp_id && u.emp_id === cur.emp_id)
  );
  if (idx === -1) return false;

  const fresh = users[idx];
  const merged = { ...cur, ...fresh };
  let changed = cur.role !== merged.role
    || cur.full_name !== merged.full_name
    || cur.status !== merged.status;

  // Back-fill English-name fields from HRMS for older accounts.
  if (!merged.fname_e || !merged.lname_e || !merged.sex_id) {
    try {
      const enriched = await enrichUserFromHrms(merged);
      if (enriched) {
        Object.assign(merged, enriched);
        changed = true;
      }
    } catch (_) { /* leave as-is on failure */ }
  }

  // Propagate any English-name data we now have into the shared mock-users
  // store (used by getUsers() + Certificate Builder) — but only flag a change
  // when the store actually lacks it, to avoid an endless re-render loop.
  if (merged.fname_e || merged.lname_e || merged.sex_id) {
    try {
      const before = readMockUserEnglishFields(merged);
      if (!before
        || before.fname_e !== (merged.fname_e || '')
        || before.lname_e !== (merged.lname_e || '')
        || before.sex_id !== (merged.sex_id || '')
        || (merged.full_name_en && before.full_name_en !== merged.full_name_en)) {
        changed = true;
      }
    } catch (_) {}
  }

  if (!changed) return false;

  // Persist everywhere the UI reads from.
  localStorage.setItem('hrbp_user', JSON.stringify(merged));
  try { setCurrentUser(merged); } catch (_) {}

  try {
    const mockRec = persistEnglishNameToMockUsers(merged);
    if (mockRec) {
      // Keep the in-memory array (and therefore the re-render) in sync.
      users[idx] = { ...users[idx], ...mockRec };
    }
  } catch (_) {}

  // Best-effort durability in D1 so the value survives across sessions/devices.
  try {
    const { updateUser } = await import('./api.js');
    await updateUser(merged.id, {
      fname_e: merged.fname_e || '',
      lname_e: merged.lname_e || '',
      sex_id: merged.sex_id || '',
    });
  } catch (_) {}

  return merged;
}