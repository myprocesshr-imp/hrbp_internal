export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  // GET /api/pickup-locations
  if (method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM pickup_locations ORDER BY name ASC'
    ).all();
    return json({ data: results });
  }

  // POST /api/pickup-locations — create
  if (method === 'POST') {
    const { name } = await request.json();
    if (!name) return json({ error: 'Name is required' }, 400);

    try {
      const result = await env.DB.prepare(
        'INSERT INTO pickup_locations (name) VALUES (?)'
      ).bind(name).run();
      const loc = await env.DB.prepare('SELECT * FROM pickup_locations WHERE id = ?')
        .bind(result.meta.last_row_id).first();
      return json({ data: [loc] }, 201);
    } catch (e) {
      if (e.message?.includes('UNIQUE')) {
        return json({ error: 'Pickup location already exists' }, 409);
      }
      throw e;
    }
  }

  // PUT /api/pickup-locations/:id — update
  if (method === 'PUT') {
    const id = url.pathname.split('/').pop();
    const { name } = await request.json();
    if (!name) return json({ error: 'Name is required' }, 400);

    await env.DB.prepare('UPDATE pickup_locations SET name = ? WHERE id = ?').bind(name, id).run();
    const loc = await env.DB.prepare('SELECT * FROM pickup_locations WHERE id = ?').bind(id).first();
    return json({ data: [loc] });
  }

  // DELETE /api/pickup-locations/:id
  if (method === 'DELETE') {
    const id = url.pathname.split('/').pop();
    await env.DB.prepare('DELETE FROM pickup_locations WHERE id = ?').bind(id).run();
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
