export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // Extract optional key from path: /api/cert-master-data or /api/cert-master-data/:key
  const pathParts = url.pathname.split('/');
  const keyParam = pathParts[pathParts.length - 1];
  const hasKey = keyParam && keyParam !== 'cert-master-data';

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  // GET /api/cert-master-data[/:key]
  if (method === 'GET') {
    if (hasKey) {
      const row = await env.DB.prepare(
        'SELECT value FROM cert_master_data WHERE key = ?'
      ).bind(keyParam).first();
      if (!row) return json({ data: [] });
      try {
        return json({ data: JSON.parse(row.value) });
      } catch {
        return json({ data: [] });
      }
    }

    // Return all keys as an object
    const { results } = await env.DB.prepare('SELECT key, value FROM cert_master_data').all();
    const data = {};
    for (const row of results) {
      try { data[row.key] = JSON.parse(row.value); } catch { data[row.key] = []; }
    }
    return json({ data });
  }

  // POST /api/cert-master-data — upsert key/items
  if (method === 'POST') {
    const { key, items } = await request.json();
    if (!key || !Array.isArray(items)) {
      return json({ error: 'Invalid payload: key and items[] required' }, 400);
    }
    const value = JSON.stringify(items);
    await env.DB.prepare(
      `INSERT INTO cert_master_data (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).bind(key, value).run();
    return json({ success: true, data: items });
  }

  return json({ error: 'Method not allowed' }, 405);
}
