export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  // GET /api/users — list all (with optional role filter)
  if (method === 'GET') {
    const role = url.searchParams.get('role');
    let query = 'SELECT * FROM users';
    let params = [];

    if (role) {
      query += ' WHERE role = ?';
      params.push(role);
    }
    query += ' ORDER BY full_name ASC';

    const { results } = await env.DB.prepare(query).bind(...params).all();
    const users = results.map(u => ({
      ...u,
      responsible_bu: JSON.parse(u.responsible_bu || '[]'),
    }));
    return json({ users });
  }

  // PUT /api/users/:id — update user
  if (method === 'PUT') {
    const id = url.pathname.split('/').pop();
    const body = await request.json();

    const updates = [];
    const params = [];

    for (const key of ['role', 'responsible_bu', 'full_name', 'email', 'phone', 'status', 'signature_url']) {
      if (body[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(key === 'responsible_bu' ? JSON.stringify(body[key]) : body[key]);
      }
    }

    if (updates.length === 0) return json({ error: 'No fields to update' }, 400);

    updates.push("updated_at = datetime('now')");
    params.push(id);

    await env.DB.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run();

    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    if (user) user.responsible_bu = JSON.parse(user.responsible_bu || '[]');
    return json({ user });
  }

  return json({ error: 'Method not allowed' }, 405);
}
