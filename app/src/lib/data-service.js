/**
 * Central Data Service Layer
 *
 * Provides a unified event-driven interface for request CRUD operations.
 * - Components subscribe to 'requests-updated' to react to data changes
 * - All mutations go through this service (optimistic update + rollback)
 * - Eliminates direct localStorage manipulation from components
 * - Single source of truth for request data across the app
 */
import { getEmployeeRequests, cancelRequest, updateRequest } from './api.js';
import { enrichRequestDownloadAccess } from './download-policy.js';
import { t } from './i18n.js';

class DataService {
  constructor() {
    /** @type {Object.<string, Function[]>} */
    this._listeners = {};

    /** @type {{ requests: Array, pagination: Object, stats: Object }} */
    this._cache = { requests: [], pagination: {}, stats: {} };

    /** @type {Object} Last filters used for fetch — used for auto-refetch after mutations */
    this._lastFilters = { page: 1, limit: 10, search: '', status: '', user_id: '' };
  }

  // ═══════════════════════════════════════════════════════════════
  //  Event System
  // ═══════════════════════════════════════════════════════════════

  /**
   * Subscribe to an event.
   * @param {'requests-updated'|'error'} event
   * @param {Function} handler — receives ({ requests, pagination, stats })
   * @returns {Function} unsubscribe function
   */
  on(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const list = this._listeners[event];
    if (!list) return;
    this._listeners[event] = list.filter(h => h !== handler);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(fn => {
      try { fn(data); } catch (e) { console.error('[DataService] listener error:', e); }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  Cache Accessors
  // ═══════════════════════════════════════════════════════════════

  get requests() { return this._cache.requests || []; }
  get stats()    { return this._cache.stats || {}; }
  get pagination() { return this._cache.pagination || {}; }
  get cache()    { return this._cache; }

  /**
   * Set the cache directly (used when page loads with pre-fetched data).
   * This ensures the dataService cache is in sync with the page data
   * so that cancel/update operations work correctly.
   */
  setData(data) {
    this._cache = {
      requests: data?.requests || [],
      pagination: data?.pagination || {},
      stats: data?.stats || {},
    };
    this._emit('requests-updated', this._cache);
  }

  // ═══════════════════════════════════════════════════════════════
  //  Fetch
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fetch requests and update cache.
   * Components should call this on mount, then react to 'requests-updated'.
   */
  async fetchRequests(filters = {}) {
    this._lastFilters = { ...this._lastFilters, ...filters };
    try {
      const result = await getEmployeeRequests(this._lastFilters);
      // Enrich download access for each request
      const enriched = (result.requests || []).map(r => enrichRequestDownloadAccess(r));
      this._cache = {
        requests: enriched,
        pagination: result.pagination || {},
        stats: result.stats || {},
      };
      this._emit('requests-updated', this._cache);
      return this._cache;
    } catch (err) {
      console.error('[DataService] fetchRequests failed:', err);
      this._emit('error', { error: err, action: 'fetch' });
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  Cancel Request
  // ═══════════════════════════════════════════════════════════════

  /**
   * Cancel a request with optimistic UI update.
   * On success: cache is updated with server response.
   * On failure: cache is rolled back to previous state.
   */
  async cancelRequest(id) {
    const prevCache = this._cloneCache();
    this._applyOptimisticCancel(id);
    this._emit('requests-updated', this._cache);

    try {
      const result = await cancelRequest(id);
      if (!result || !result.success) {
        throw new Error(result?.error || 'API responded without success flag');
      }
      // Replace optimistic data with canonical server response
      if (result.request) {
        this._applyServerResponse(id, result.request);
      }
      // Sync to localStorage for persistence
      this._syncToLocalStorage();
      this._emit('requests-updated', this._cache);
      return result;
    } catch (err) {
      // Rollback
      this._cache = prevCache;
      this._emit('requests-updated', this._cache);
      this._emit('error', { error: err, action: 'cancel', id });
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  Update Request (acknowledge, reject, mark-delivered, etc.)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Update a request with optimistic UI update.
   * Used by HR for: acknowledge (set ETA), reject, mark delivered, etc.
   */
  async updateRequest(id, data) {
    const prevCache = this._cloneCache();
    this._applyOptimisticUpdate(id, data);
    this._emit('requests-updated', this._cache);

    try {
      const result = await updateRequest(id, data);
      if (result?.request) {
        this._applyServerResponse(id, result.request);
      }
      this._syncToLocalStorage();
      this._emit('requests-updated', this._cache);
      return result;
    } catch (err) {
      // Rollback
      this._cache = prevCache;
      this._emit('requests-updated', this._cache);
      this._emit('error', { error: err, action: 'update', id });
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  Optimistic Update Helpers
  // ═══════════════════════════════════════════════════════════════

  _applyOptimisticCancel(id) {
    this._cache.requests = this._cache.requests.map(r => {
      if (r.request_code !== id && String(r.id) !== String(id)) return r;
      const meta = { ...(r.request_data || {}), cancelled_by_employee: true, cancelled_at: new Date().toISOString(), statusLabel: t('status.cancelled') };
      return {
        ...r, status: 'cancelled', statusLabel: t('status.cancelled'),
        cancelled_by_employee: true, cancelled_at: new Date().toISOString(),
        canCancel: false, can_cancel: false,
        request_data: meta,
      };
    });
    if (this._cache.stats?.open_requests > 0) {
      this._cache.stats.open_requests -= 1;
    }
  }

  _applyOptimisticUpdate(id, data) {
    this._cache.requests = this._cache.requests.map(r => {
      if (String(r.id) !== String(id) && r.request_code !== id) return r;
      return { ...r, ...data };
    });
  }

  _applyServerResponse(id, serverReq) {
    this._cache.requests = this._cache.requests.map(r => {
      if (String(r.id) !== String(id) && r.request_code !== id) return r;
      return { ...r, ...serverReq, canCancel: false, can_cancel: false };
    });
    // Recalculate stats from enriched requests
    const all = this._cache.requests;
    const openReqs = all.filter(r => r.status === 'submitted' || r.status === 'in-review').length;
    const approvedReqs = all.filter(r => r.status === 'approved').length;
    const rejectedReqs = all.filter(r => r.status === 'rejected').length;
    const completedReqs = approvedReqs + rejectedReqs;
    this._cache.stats = {
      ...this._cache.stats,
      open_requests: openReqs,
      success_rate: completedReqs > 0 ? Math.round((approvedReqs / completedReqs) * 1000) / 10 : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  Persistence
  // ═══════════════════════════════════════════════════════════════

  _syncToLocalStorage() {
    try {
      const existing = JSON.parse(localStorage.getItem('hrbp_employee_requests') || '[]');
      const merged = this._cache.requests.map(r => {
        const stored = existing.find(e => e.id === r.id || e.request_code === r.request_code);
        return stored ? { ...stored, ...r } : r;
      });
      localStorage.setItem('hrbp_employee_requests', JSON.stringify(merged));
    } catch (e) {
      console.warn('[DataService] localStorage sync failed:', e);
    }
  }

  _cloneCache() {
    return {
      requests: [...(this._cache.requests || [])],
      pagination: { ...(this._cache.pagination || {}) },
      stats: { ...(this._cache.stats || {}) },
    };
  }
}

/** Singleton instance — shared across all components */
export const dataService = new DataService();