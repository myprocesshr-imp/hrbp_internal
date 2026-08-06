export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  // GET /api/template-categories
  if (method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM template_categories ORDER BY sort_order ASC, name ASC'
    ).all();
    return json({ data: results });
  }

  // POST /api/template-categories — create
  if (method === 'POST') {
    const { name, icon, sort_order } = await request.json();
    if (!name) return json({ error: 'Name is required' }, 400);

    try {
      const maxOrder = (await env.DB.prepare(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM template_categories'
      ).first())?.next || 1;

      const result = await env.DB.prepare(
        'INSERT INTO template_categories (name, icon, sort_order) VALUES (?, ?, ?)'
      ).bind(name, icon || 'folder', sort_order ?? maxOrder).run();
      const cat = await env.DB.prepare('SELECT * FROM template_categories WHERE id = ?')
        .bind(result.meta.last_row_id).first();
      return json({ data: [cat] }, 201);
    } catch (e) {
      if (e.message?.includes('UNIQUE')) {
        return json({ error: 'Category already exists' }, 409);
      }
      throw e;
    }
  }

  // PUT /api/template-categories/:id — update
  if (method === 'PUT') {
    const id = url.pathname.split('/').pop();
    const { name, icon, sort_order, status } = await request.json();

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (icon !== undefined) { updates.push('icon = ?'); params.push(icon); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (updates.length === 0) return json({ error: 'No fields to update' }, 400);

    params.push(id);
    try {
      await env.DB.prepare(`UPDATE template_categories SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
      const cat = await env.DB.prepare('SELECT * FROM template_categories WHERE id = ?').bind(id).first();
      return json({ data: [cat] });
    } catch (e) {
      if (e.message?.includes('UNIQUE')) {
        return json({ error: 'Category already exists' }, 409);
      }
      throw e;
    }
  }

  // DELETE /api/template-categories/:id
  if (method === 'DELETE') {
    const id = url.pathname.split('/').pop();
    await env.DB.prepare('DELETE FROM template_categories WHERE id = ?').bind(id).run();
    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
