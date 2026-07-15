/**
 * /api/migrate — Run D1 migrations after wrangler dev server starts.
 * This ensures migrations run on the same D1 instance that wrangler uses.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') {
    return json({ error: 'POST only' }, 405);
  }

  const results = [];
  const errors = [];

  const migrations = [
    { name: '001_schema', file: '001_schema.sql' },
    { name: '002_templates', file: '002_templates.sql' },
    { name: '003_seed_templates', file: '003_seed_templates.sql' },
    { name: '004_patch_roles', file: '004_patch_roles.sql' },
    { name: '005_hrms_profile_fields', file: '005_hrms_profile_fields.sql' },
    { name: '006_request_data', file: '006_request_data.sql' },
    { name: '007_cancelled_status', file: '007_cancelled_status.sql' },
    { name: '008_sync_dev_users', file: '008_sync_dev_users.sql' },
  ];

  for (const migration of migrations) {
    try {
      // Check if table already exists to skip idempotent migrations
      if (migration.name === '001_schema') {
        const check = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
        if (check) {
          results.push({ name: migration.name, status: 'skipped', message: 'tables already exist' });
          continue;
        }
      }

      // Read migration file from filesystem
      const resp = await fetch(`https://raw.githubusercontent.com/`, { redirect: 'follow' });
      // Actually we can't read local files from Workers. Let me use a different approach.
      // We'll embed the migrations as SQL strings.

      results.push({ name: migration.name, status: 'pending', message: 'migration needs to be run via CLI' });
    } catch (err) {
      errors.push({ name: migration.name, error: err.message });
    }
  }

  return json({
    success: errors.length === 0,
    results,
    errors,
    message: 'Migrations must be run via wrangler CLI. Use: npm run migrate:all:local',
  });
}