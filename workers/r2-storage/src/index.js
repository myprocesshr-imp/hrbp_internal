export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      'Access-Control-Max-Age': '86400',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const isMutation = method === 'POST' || method === 'DELETE';
    if (isMutation) {
      const apiKey = request.headers.get('X-API-Key');
      if (!apiKey || apiKey !== env.API_KEY) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const path = url.pathname.replace(/\/$/, '');

    try {
      if (method === 'POST' && path === '/upload') {
        return await handleUpload(request, env, corsHeaders);
      }
      if (method === 'GET' && path.startsWith('/file/')) {
        const key = decodeURIComponent(path.slice(6));
        return await handleGetFile(key, env, corsHeaders);
      }
      if (method === 'DELETE' && path.startsWith('/file/')) {
        const key = decodeURIComponent(path.slice(6));
        return await handleDeleteFile(key, env, corsHeaders);
      }
      if (method === 'GET' && path === '/list') {
        const prefix = url.searchParams.get('prefix') || '';
        return await handleListFiles(prefix, env, corsHeaders);
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

async function handleUpload(request, env, corsHeaders) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) {
    return new Response(JSON.stringify({ error: 'No file provided' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const prefix = formData.get('prefix') || 'general';
  const ext = file.name.split('.').pop();
  const uuid = crypto.randomUUID();
  const key = `${prefix}/${uuid}-${file.name}`;

  const arrayBuffer = await file.arrayBuffer();
  await env.HRBP_BUCKET.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: file.name },
  });

  const publicUrl = `${new URL(request.url).origin}/file/${encodeURIComponent(key)}`;

  return new Response(JSON.stringify({
    key,
    url: publicUrl,
    name: file.name,
    size: file.size,
    type: file.type,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetFile(key, env, corsHeaders) {
  const object = await env.HRBP_BUCKET.get(key);
  if (!object) {
    return new Response(JSON.stringify({ error: 'File not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const headers = {
    ...corsHeaders,
    'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
    'Content-Length': object.size,
    'ETag': object.httpEtag,
    'Cache-Control': 'public, max-age=31536000, immutable',
  };

  return new Response(object.body, { headers });
}

async function handleDeleteFile(key, env, corsHeaders) {
  const object = await env.HRBP_BUCKET.get(key);
  if (!object) {
    return new Response(JSON.stringify({ error: 'File not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await env.HRBP_BUCKET.delete(key);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleListFiles(prefix, env, corsHeaders) {
  const objects = await env.HRBP_BUCKET.list({ prefix });
  const files = objects.objects.map(obj => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded,
    contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
  }));

  return new Response(JSON.stringify({ files, truncated: objects.truncated }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
