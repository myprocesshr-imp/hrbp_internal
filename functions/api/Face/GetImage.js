import { proxyRequest } from '../../lib/proxy.js';

const FACE_ORIGIN = 'https://wms.advanceagro.net';

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
      },
    });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    return await proxyRequest(request, {
      targetOrigin: FACE_ORIGIN,
      rewritePath: (pathname) => pathname.replace(/^\/api\/Face\/GetImage/, '/WSVIS/api/Face/GetImage'),
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Face image proxy error', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}