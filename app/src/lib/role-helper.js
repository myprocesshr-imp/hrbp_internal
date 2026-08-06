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
 * Quota safety: the D1 write (PUT /users/:id) sets `updated_at = datetime('now')`
 * server-side, which would otherwise make the caller's sync signature change on
 * every render and re-trigger a hashchange → re-render loop forever. To prevent
 * that:
 *  - HRMS enrichment runs at most once per session per employee,
 *  - the D1 PUT is skipped when the server already holds the target values,
 *  - `changed` is only reported for fields that actually affect the rendered UI.
 *
 * @returns {Promise<object|false>} the enriched/merged user when something
 *          changed, otherwise false.
 */

/** Session-level guard: employee IDs already attempted for HRMS enrichment. */
const _enrichAttempted = new Set();
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
  // Preserve locally-enriched English-name fields (HRMS back-fill) when the
  // backend record doesn't carry them yet. Plain `{ ...cur, ...fresh }` lets a
  // fresh record that lacks fname_e/lname_e/sex_id clobber the values we just
  // enriched, so the sync never converges and the layout re-renders forever.
  const merged = {
    ...cur,
    ...fresh,
    fname_e: cur.fname_e || fresh.fname_e || '',
    lname_e: cur.lname_e || fresh.lname_e || '',
    sex_id: cur.sex_id || fresh.sex_id || '',
    full_name_en: cur.full_name_en || fresh.full_name_en || '',
  };
  let changed = cur.role !== merged.role
    || cur.full_name !== merged.full_name
    || cur.status !== merged.status;

  // Back-fill English-name fields from HRMS for older accounts. This only runs
  // once per session per employee; if the server already has these values there
  // is nothing to back-fill and the D1 PUT below must be skipped (otherwise the
  // resulting updated_at change would loop the caller's re-render forever).
  if (!merged.fname_e || !merged.lname_e || !merged.sex_id) {
    if (!_enrichAttempted.has(merged.emp_id || merged.id)) {
      _enrichAttempted.add(merged.emp_id || merged.id);
      try {
        const enriched = await enrichUserFromHrms(merged);
        if (enriched) {
          Object.assign(merged, enriched);
          changed = true;
        }
      } catch (_) { /* leave as-is on failure */ }
    }
  }

  // Propagate English-name fields into the shared mock-users store, and only
  // flag a re-render when the store actually changed. Comparing the store state
  // before/after (instead of `!before`) keeps this convergent even when the
  // store has no matching record — e.g. production accounts that never touched
  // the mock store — so it can't re-trigger an endless re-render loop.
  if (merged.fname_e || merged.lname_e || merged.sex_id) {
    try {
      const before = readMockUserEnglishFields(merged);
      const after = persistEnglishNameToMockUsers(merged);
      const fieldsOf = (rec) => rec
        ? `${rec.fname_e || ''}|${rec.lname_e || ''}|${rec.sex_id || ''}|${rec.full_name_en || ''}`
        : null;
      if (fieldsOf(before) !== fieldsOf(after)) changed = true;
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
  // Only write when the server actually lacks a value we now hold — an
  // unconditional PUT would bump `updated_at` server-side and re-trigger the
  // caller's sync loop on every render.
  try {
    const { updateUser } = await import('./api.js');
    const needsFname = !fresh.fname_e && merged.fname_e;
    const needsLname = !fresh.lname_e && merged.lname_e;
    const needsSex = !fresh.sex_id && merged.sex_id;
    if (needsFname || needsLname || needsSex) {
      await updateUser(merged.id, {
        fname_e: merged.fname_e || '',
        lname_e: merged.lname_e || '',
        sex_id: merged.sex_id || '',
      });
    }
  } catch (_) {}

  return merged;
}