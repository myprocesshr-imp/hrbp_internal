/**
 * Forward browser requests to external HR APIs from Cloudflare Pages.
 */
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

  const response = await fetch(targetUrl, init);
  const outHeaders = new Headers(response.headers);
  outHeaders.set('Access-Control-Allow-Origin', '*');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outHeaders,
  });
}