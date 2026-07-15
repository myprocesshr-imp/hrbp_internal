export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const key = decodeURIComponent(url.pathname.replace('/api/file/', ''));

  if (!key) {
    return new Response(JSON.stringify({ error: 'File key required' }), { status: 400 });
  }

  // GET /api/file/:key — download
  if (method === 'GET') {
    const object = await env.HRBP_BUCKET.get(key);
    if (!object) {
      return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 });
    }
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  // DELETE /api/file/:key
  if (method === 'DELETE') {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== env.API_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    await env.HRBP_BUCKET.delete(key);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
}
