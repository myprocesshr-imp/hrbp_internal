/**
 * Simple hash-based SPA Router
 * Supports: navigate, onRouteChange, getCurrentRoute
 */
import { t } from './lib/i18n.js';

const routes = {};
let currentCleanup = null;
let _isNavigating = false;
let _routeQueued = false;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  return (window.location.hash.slice(1) || '/login').split('?')[0];
}

export function startRouter() {
  const handleRoute = async () => {
    if (_isNavigating) {
      _routeQueued = true;
      return;
    }
    _isNavigating = true;

    const path = getCurrentRoute();
    const appEl = document.getElementById('app');

    // Run cleanup from previous page
    if (currentCleanup && typeof currentCleanup === 'function') {
      try { currentCleanup(); } catch (_) {}
      currentCleanup = null;
    }

    // Find matching route
    const handler = routes[path];
    try {
      if (handler) {
        const result = await handler(appEl);
        if (typeof result === 'function') {
          currentCleanup = result;
        }
      } else {
        // 404 - redirect to login
        history.replaceState(null, '', '#/login');
        const loginHandler = routes['/login'];
        if (loginHandler) await loginHandler(appEl);
      }
    } catch (err) {
      console.error(`[Router] Error on route "${path}":`, err);
      if (appEl && getCurrentRoute() === path) {
        appEl.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;">
            <div style="text-align:center;padding:2rem;">
              <p style="font-size:1rem;font-weight:600;color:#1a1b21;">${t('error.loadPage')}</p>
              <p style="font-size:0.8rem;color:#757682;margin-top:0.5rem;">${err.message || 'Unknown error'}</p>
              <button onclick="window.location.reload()" style="margin-top:1rem;padding:0.5rem 1.5rem;background:#00236f;color:#fff;border:none;border-radius:8px;cursor:pointer;">${t('common.reload')}</button>
            </div>
          </div>`;
      }
    } finally {
      _isNavigating = false;
      if (_routeQueued) {
        _routeQueued = false;
        const latest = getCurrentRoute();
        if (latest !== path) handleRoute();
      }
    }
  };

  window.addEventListener('hashchange', handleRoute);

  // Handle initial route using replaceState so it does NOT fire hashchange again
  if (!window.location.hash || window.location.hash === '#') {
    history.replaceState(null, '', '#/login');
  }
  // Always trigger once on startup
  handleRoute();
}

/**
 * Helper to attach click handlers to navigation links
 * Use data-navigate attribute on elements
 */
export function attachNavigation(container) {
  container.querySelectorAll('[data-navigate]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const target = el.getAttribute('data-navigate');
      navigate(target);
    });
  });
}
