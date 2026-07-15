import { proxyRequest } from '../../lib/proxy.js';

const IDMS_ORIGIN = 'https://mobiledev.advanceagro.net';

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
      },
    });
  }

  try {
    return await proxyRequest(request, {
      targetOrigin: IDMS_ORIGIN,
      rewritePath: (pathname) => pathname.replace(/^\/api\/idms/, '/ws/api/idms'),
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'IDMS proxy error', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}