/**
 * Forward browser requests to external HR APIs from Cloudflare Pages.
 *
 * Includes a bounded fetch timeout and one retry on transient failures so a
 * slow upstream (e.g. the IDMS/HRMS servers) doesn't surface as a Cloudflare
 * edge 504 that the client misreads as an auth failure.
 */
const UPSTREAM_TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 2;

export async function proxyRequest(request, { targetOrigin, rewritePath }) {
  const url = new URL(request.url);
  const targetPath = rewritePath(url.pathname);
  const targetUrl = `${targetOrigin}${targetPath}${url.search}`;

  const headers = new Headers();
  const forward = ['accept', 'accept-language', 'content-type', 'authorization'];
  for (const name of forward) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const init = {
    method: request.method,
    headers,
    redirect: 'follow',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
      try {
        const response = await fetch(targetUrl, { ...init, signal: controller.signal });
        const outHeaders = new Headers(response.headers);
        outHeaders.set('Access-Control-Allow-Origin', '*');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: outHeaders,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      lastError = err;
      // Don't retry the last attempt; give the previous error a moment to settle.
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }

  throw lastError;
}