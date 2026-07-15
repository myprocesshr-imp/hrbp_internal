export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { action, username, password, profile } = await request.json();

  if (action === 'login') {
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).bind(username).first();

    if (user) {
      user.responsible_bu = JSON.parse(user.responsible_bu || '[]');
      return new Response(JSON.stringify({ user }), { status: 200 });
    }

    // User not found in DB — return signal for auto-provisioning
    return new Response(JSON.stringify({ needsProvisioning: true }), { status: 200 });
  }

  if (action === 'register') {
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(profile.username).first();

    if (existing) {
      return new Response(JSON.stringify({ error: 'User already exists' }), { status: 409 });
    }

    const result = await env.DB.prepare(
      `INSERT INTO users (username, full_name, emp_id, email, phone, position, department, company_name, role, start_date, sex_id, fname_e, lname_e)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      profile.username, profile.full_name, profile.emp_id,
      profile.email, profile.phone, profile.position,
      profile.department, profile.company_name,
      profile.role || 'employee',
      profile.start_date || '',
      profile.sex_id || '',
      profile.fname_e || '',
      profile.lname_e || ''
    ).run();

    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(result.meta.last_row_id).first();
    user.responsible_bu = JSON.parse(user.responsible_bu || '[]');
    return new Response(JSON.stringify({ user }), { status: 201 });
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
}
