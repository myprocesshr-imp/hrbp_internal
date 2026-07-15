export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  // GET /api/business-units
  if (method === 'GET') {
    const columns = url.searchParams.get('columns') || '*';
    const { results } = await env.DB.prepare(
      `SELECT ${columns} FROM business_units ORDER BY name ASC`
    ).all();
    return json({ data: results });
  }

  // POST /api/business-units — create
  if (method === 'POST') {
    const { name } = await request.json();
    if (!name) return json({ error: 'Name is required' }, 400);

    try {
      const result = await env.DB.prepare(
        'INSERT INTO business_units (name) VALUES (?)'
      ).bind(name).run();
      const bu = await env.DB.prepare('SELECT * FROM business_units WHERE id = ?')
        .bind(result.meta.last_row_id).first();
      return json({ data: [bu] }, 201);
    } catch (e) {
      if (e.message?.includes('UNIQUE')) {
        return json({ error: 'Business unit already exists' }, 409);
      }
      throw e;
    }
  }

  // PUT /api/business-units/:id — update
  if (method === 'PUT') {
    const id = url.pathname.split('/').pop();
    const { name } = await request.json();
    if (!name) return json({ error: 'Name is required' }, 400);

    await env.DB.prepare('UPDATE business_units SET name = ? WHERE id = ?').bind(name, id).run();
    const bu = await env.DB.prepare('SELECT * FROM business_units WHERE id = ?').bind(id).first();
    return json({ data: [bu] });
  }

  // DELETE /api/business-units/:id
  if (method === 'DELETE') {
    const id = url.pathname.split('/').pop();
    await env.DB.prepare('DELETE FROM business_units WHERE id = ?').bind(id).run();
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
