/**
 * Helper to dynamically load employee avatars from the HRMS face image API.
 *
 * Flow:
 * 1. Request the face image via proxy: /api/Face/GetImage?EmpID=...
 * 2. Verify the response actually contains image data (Content-Length > 0)
 *    — HRMS returns HTTP 200 with 0 bytes when no photo is registered.
 * 3. If Content-Length header is absent (chunked encoding), read the blob
 *    to check actual byte size before setting src.
 * 4. If any step fails or returns empty, trigger the onerror fallback (person icon).
 *
 * Quota safety (Cloudflare Workers free tier — 100k requests/day account-wide):
 * - Results are cached per EmpID (in-memory + localStorage) so a re-render or
 *   a later page visit never re-fetches the same face image.
 * - In-flight requests are deduplicated: concurrent callers for the same EmpID
 *   wait on a single network request instead of firing N duplicates.
 */

const STATUS_KEY = 'hrbp_avatar_cache_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — a face photo changes rarely

/** @type {Map<string, {state: 'loading'|'ok'|'missing'|'error', url: ?string, promise: ?Promise<void>}>} */
const memoryCache = new Map();

function readPersistentCache() {
  try {
    return JSON.parse(localStorage.getItem(STATUS_KEY) || '{}');
  } catch (_) { return {}; }
}

function writePersistentCache(cache) {
  try {
    // Prune expired entries on write to keep the store small.
    const now = Date.now();
    const pruned = Object.fromEntries(
      Object.entries(cache).filter(([, v]) => (now - (v.ts || 0)) < CACHE_TTL_MS)
    );
    localStorage.setItem(STATUS_KEY, JSON.stringify(pruned));
  } catch (_) { /* storage full/blocked — memory cache still works */ }
}

function cachedState(empId) {
  const mem = memoryCache.get(empId);
  if (mem) return mem;
  const cache = readPersistentCache();
  const rec = cache[empId];
  if (!rec || (Date.now() - (rec.ts || 0)) >= CACHE_TTL_MS) return null;
  const state = { state: rec.state, url: rec.url || null, promise: null };
  memoryCache.set(empId, state);
  return state;
}

function rememberState(empId, state) {
  memoryCache.set(empId, state);
  const cache = readPersistentCache();
  // Only persist stable URLs. Blob URLs are tied to the current document and
  // are useless across sessions — keep those in memory only.
  const persistUrl = (state.url || '').startsWith('blob:') ? '' : (state.url || '');
  cache[empId] = { state: state.state, url: persistUrl, ts: Date.now() };
  writePersistentCache(cache);
}

export async function loadAvatarForElement(imgElement, empId) {
  if (!empId || !imgElement || !imgElement.isConnected) return;

  const cached = cachedState(empId);
  if (cached) {
    if (cached.state === 'missing' || cached.state === 'error') {
      // Known to have no photo — skip the network round-trip entirely.
      triggerFallback(imgElement);
      return;
    }
    if (cached.state === 'ok' && cached.url) {
      // Known good photo — reuse it (browser/edge caches absorb the request).
      imgElement.src = cached.url;
      return;
    }
    if (cached.state === 'loading' && cached.promise) {
      // A request for this EmpID is already in flight — just wait on it.
      await cached.promise;
      const settled = memoryCache.get(empId);
      if (settled && settled.state === 'ok' && settled.url) {
        imgElement.src = settled.url;
      } else {
        triggerFallback(imgElement);
      }
      return;
    }
  }

  // Fresh EmpID — start (or join) a single network request.
  let entry = memoryCache.get(empId);
  if (!entry || entry.state !== 'loading' || !entry.promise) {
    entry = { state: 'loading', url: null, promise: null };
    memoryCache.set(empId, entry);
    entry.promise = fetchAvatar(entry, empId);
  }
  await entry.promise;
  if (imgElement.isConnected) {
    if (entry.state === 'ok' && entry.url) {
      imgElement.src = entry.url;
    } else {
      triggerFallback(imgElement);
    }
  }
}

async function fetchAvatar(entry, empId) {
  try {
    const imageUrl = `/api/Face/GetImage?CardID=${empId}`;
    const imgRes = await fetch(imageUrl);

    if (!imgRes.ok) {
      entry.state = 'missing';
      rememberState(empId, { state: 'missing', url: null });
      return;
    }

    const contentLengthHeader = imgRes.headers.get('content-length');
    if (contentLengthHeader !== null) {
      if (parseInt(contentLengthHeader, 10) === 0) {
        entry.state = 'missing';
        rememberState(empId, { state: 'missing', url: null });
        return;
      }
      entry.state = 'ok';
      entry.url = imageUrl;
      rememberState(empId, { state: 'ok', url: imageUrl });
      return;
    }

    // Chunked encoding — read the blob to check real byte size.
    const blob = await imgRes.blob();
    if (blob.size === 0) {
      entry.state = 'missing';
      rememberState(empId, { state: 'missing', url: null });
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    entry.state = 'ok';
    entry.url = objectUrl;
    rememberState(empId, { state: 'ok', url: objectUrl });
  } catch (err) {
    console.error(`[Avatar] Failed to load avatar for EmpID ${empId}:`, err);
    entry.state = 'error';
    rememberState(empId, { state: 'error', url: null });
  }
}

function triggerFallback(imgElement) {
  if (imgElement && typeof imgElement.onerror === 'function') {
    imgElement.onerror();
  }
}
