export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  // Safely parse the request body. A malformed/empty body must return 400,
  // not an unhandled 500.
  async function parseBody(req) {
    try {
      return await req.json();
    } catch {
      return {};
    }
  }

  // Normalize enum-like fields so a stray value can never trip a CHECK
  // constraint and bubble up as a 500.
  const LANGUAGES = ['th', 'en', 'both'];
  const STATUSES = ['draft', 'published', 'disabled'];

  const normalizeLanguage = (v) =>
    LANGUAGES.includes(v) ? v : 'th';
  const normalizeStatus = (v) =>
    STATUSES.includes(v) ? v : 'draft';

  // Detect whether the templates table already has a `language` column.
  // This keeps the endpoint working even if migration 012 hasn't been applied,
  // instead of 500-ing on `no such column: language`.
  async function hasLanguageColumn() {
    try {
      const { results } = await env.DB.prepare(
        "SELECT name FROM pragma_table_info('templates') WHERE name = 'language'"
      ).all();
      return Array.isArray(results) && results.length > 0;
    } catch {
      return false;
    }
  }

  // GET /api/templates
  if (method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM templates ORDER BY category ASC, id ASC'
    ).all();
    return json({ data: results });
  }

  // POST /api/templates - create template
  if (method === 'POST') {
    const body = await parseBody(request);
    const { id, name, category, content, status, version, updated_by, language } = body;
    if (!id || !name || !category) {
      return json({ error: 'ID, Name, and Category are required' }, 400);
    }

    const lang = normalizeLanguage(language);
    const st = normalizeStatus(status);
    const hasLang = await hasLanguageColumn();

    try {
      if (hasLang) {
        await env.DB.prepare(
          `INSERT INTO templates (id, name, category, content, status, version, updated_at, updated_by, language)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)`
        ).bind(
          id, name, category, content || '', st,
          version || 'V 1.0', updated_by || 'System', lang
        ).run();
      } else {
        await env.DB.prepare(
          `INSERT INTO templates (id, name, category, content, status, version, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`
        ).bind(
          id, name, category, content || '', st,
          version || 'V 1.0', updated_by || 'System'
        ).run();
      }

      const tmpl = await env.DB.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first();
      return json({ data: tmpl }, 201);
    } catch (e) {
      console.error('[Templates POST Error]', e);
      if (e.message?.includes('UNIQUE')) {
        return json({ error: 'Template with this ID already exists' }, 409);
      }
      return json({ error: e.message }, 500);
    }
  }

  // PUT /api/templates/:id - update template
  if (method === 'PUT') {
    const id = url.pathname.split('/').pop();
    const body = await parseBody(request);
    const { name, category, content, status, version, updated_by, language } = body;
    if (!name || !category) {
      return json({ error: 'Name and Category are required' }, 400);
    }

    const lang = normalizeLanguage(language);
    const st = normalizeStatus(status);
    const hasLang = await hasLanguageColumn();

    try {
      if (hasLang) {
        await env.DB.prepare(
          `UPDATE templates
           SET name = ?, category = ?, content = ?, status = ?, version = ?, language = ?, updated_at = datetime('now'), updated_by = ?
           WHERE id = ?`
        ).bind(
          name, category, content || '', st,
          version || 'V 1.0', lang, updated_by || 'System', id
        ).run();
      } else {
        await env.DB.prepare(
          `UPDATE templates
           SET name = ?, category = ?, content = ?, status = ?, version = ?, updated_at = datetime('now'), updated_by = ?
           WHERE id = ?`
        ).bind(
          name, category, content || '', st,
          version || 'V 1.0', updated_by || 'System', id
        ).run();
      }

      const tmpl = await env.DB.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first();
      if (!tmpl) {
        return json({ error: 'Template not found' }, 404);
      }
      return json({ data: tmpl });
    } catch (e) {
      console.error('[Templates PUT Error]', e);
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
