export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  // GET /api/templates
  if (method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM templates ORDER BY category ASC, id ASC'
    ).all();
    return json({ data: results });
  }

  // POST /api/templates - create template
  if (method === 'POST') {
    const { id, name, category, content, status, version, updated_by } = await request.json();
    if (!id || !name || !category) {
      return json({ error: 'ID, Name, and Category are required' }, 400);
    }

    try {
      await env.DB.prepare(
        `INSERT INTO templates (id, name, category, content, status, version, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`
      ).bind(
        id, name, category, content || '', status || 'draft',
        version || 'V 1.0', updated_by || 'System'
      ).run();

      const tmpl = await env.DB.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first();
      return json({ data: tmpl }, 201);
    } catch (e) {
      if (e.message?.includes('UNIQUE')) {
        return json({ error: 'Template with this ID already exists' }, 409);
      }
      return json({ error: e.message }, 500);
    }
  }

  // PUT /api/templates/:id - update template
  if (method === 'PUT') {
    const id = url.pathname.split('/').pop();
    const { name, category, content, status, version, updated_by } = await request.json();
    if (!name || !category) {
      return json({ error: 'Name and Category are required' }, 400);
    }

    try {
      await env.DB.prepare(
        `UPDATE templates 
         SET name = ?, category = ?, content = ?, status = ?, version = ?, updated_at = datetime('now'), updated_by = ? 
         WHERE id = ?`
      ).bind(
        name, category, content || '', status || 'draft',
        version || 'V 1.0', updated_by || 'System', id
      ).run();

      const tmpl = await env.DB.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first();
      return json({ data: tmpl });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  // DELETE /api/templates/:id - delete template
  if (method === 'DELETE') {
    const id = url.pathname.split('/').pop();
    await env.DB.prepare('DELETE FROM templates WHERE id = ?').bind(id).run();
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
