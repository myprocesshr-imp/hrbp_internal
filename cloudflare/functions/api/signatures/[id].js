export async function onRequest(context) {
  const { params, env } = context;
  const id = params.id;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing user id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const user = await env.DB.prepare('SELECT signature_url FROM users WHERE id = ?').bind(id).first();
    if (!user || !user.signature_url) {
      return new Response('Not found', { status: 404 });
    }

    const obj = await env.HRBP_BUCKET.get(user.signature_url);
    if (!obj) {
      return new Response('Not found', { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', obj.httpMetadata?.contentType || 'image/png');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new Response(obj.body, { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
