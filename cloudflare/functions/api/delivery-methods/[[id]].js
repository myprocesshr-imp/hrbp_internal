export async function onRequest(context) {
  const { request, env } = context;

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

  try {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }

    if (method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT * FROM delivery_methods ORDER BY name ASC'
      ).all();
      return json({ data: results });
    }

    if (method === 'POST') {
      const { name } = await request.json();
      if (!name) return json({ error: 'Name is required' }, 400);
      try {
        const result = await env.DB.prepare(
          'INSERT INTO delivery_methods (name) VALUES (?)'
        ).bind(name).run();
        const loc = await env.DB.prepare('SELECT * FROM delivery_methods WHERE id = ?')
          .bind(result.meta.last_row_id).first();
        return json({ data: [loc] }, 201);
      } catch (e) {
        if (e.message?.includes('UNIQUE')) return json({ error: 'Delivery method already exists' }, 409);
        throw e;
      }
    }

    if (method === 'PUT') {
      const id = url.pathname.split('/').pop();
      const { name } = await request.json();
      if (!name) return json({ error: 'Name is required' }, 400);
      await env.DB.prepare('UPDATE delivery_methods SET name = ? WHERE id = ?').bind(name, id).run();
      const loc = await env.DB.prepare('SELECT * FROM delivery_methods WHERE id = ?').bind(id).first();
      return json({ data: [loc] });
    }

    if (method === 'DELETE') {
      const id = url.pathname.split('/').pop();
      await env.DB.prepare('DELETE FROM delivery_methods WHERE id = ?').bind(id).run();
      return json({ success: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    return json({ error: err.message || 'Internal server error', stack: err.stack }, 500);
  }
}
