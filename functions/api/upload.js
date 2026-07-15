import { isAllowedUploadOrigin, validateUploadFile } from '../lib/upload-guard.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  if (!isAllowedUploadOrigin(request)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const fileError = validateUploadFile(file);
  if (fileError) {
    return new Response(JSON.stringify({ error: fileError }), { status: 400 });
  }

  const prefix = (formData.get('prefix') || 'general').toString().replace(/[^a-z0-9_-]/gi, '');
  const uuid = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${prefix || 'general'}/${uuid}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  await env.HRBP_BUCKET.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
    customMetadata: { originalName: file.name },
  });

  return new Response(JSON.stringify({
    key,
    name: file.name,
    size: file.size,
    type: file.type,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}