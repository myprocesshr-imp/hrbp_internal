import { proxyRequest } from '../../lib/proxy.js';

const HRMS_ORIGIN = 'https://api-idms.advanceagro.net';

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
      targetOrigin: HRMS_ORIGIN,
      rewritePath: (pathname) => pathname.replace(/^\/api\/hrms/, '/hrms'),
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'HRMS proxy error', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}