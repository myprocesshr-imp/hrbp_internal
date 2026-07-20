const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function isAllowedUploadOrigin(request, env = {}) {
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';

  // Allow an explicit custom domain to be configured per-environment.
  const configured = (env.ALLOWED_UPLOAD_ORIGIN || '').toString().trim();

  const check = (value) => {
    if (!value) return false;
    try {
      const { hostname, protocol } = new URL(value);
      if (protocol !== 'https:' && protocol !== 'http:') return false;
      if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
      if (configured && hostname === configured) return true;
      // Cloudflare managed domains (Pages + Workers) — safe to trust as first-party.
      if (hostname === 'hrbp-internal.pages.dev' || hostname.endsWith('.hrbp-internal.pages.dev')) return true;
      if (hostname.endsWith('.pages.dev') || hostname.endsWith('.workers.dev')) return true;
      return false;
    } catch {
      return false;
    }
  };

  return check(origin) || check(referer);
}

export function validateUploadFile(file) {
  if (!file || typeof file.size !== 'number') {
    return 'No file provided';
  }
  if (file.size <= 0) {
    return 'Empty file';
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'File exceeds 10 MB limit';
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return 'File type not allowed';
  }
  return null;
}