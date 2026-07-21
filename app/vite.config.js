import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const useWrangler = env.VITE_USE_WRANGLER === 'true';

  // Wrangler proxies — only active when VITE_USE_WRANGLER=true in .env
  const wranglerProxy = useWrangler
    ? {
        '/api/auth':           { target: 'http://localhost:8788', changeOrigin: true },
        '/api/users':          { target: 'http://localhost:8788', changeOrigin: true },
        '/api/requests':       { target: 'http://localhost:8788', changeOrigin: true },
        '/api/business-units': { target: 'http://localhost:8788', changeOrigin: true },
        '/api/upload':         { target: 'http://localhost:8788', changeOrigin: true },
        '/api/file':           { target: 'http://localhost:8788', changeOrigin: true },
        '/api/templates':      { target: 'http://localhost:8788', changeOrigin: true },
        '/api/pickup-locations': { target: 'http://localhost:8788', changeOrigin: true },
        '/api/delivery-methods': { target: 'http://localhost:8788', changeOrigin: true },
        '/api/cert-master-data': { target: 'http://localhost:8788', changeOrigin: true },
        '/api/signatures':      { target: 'http://localhost:8788', changeOrigin: true },
      }
    : {};  // ← no proxy → api.js falls back to localStorage mock instantly

  return {
    root: '.',
    server: {
      host: true,
      port: 3000,
      strictPort: true,
      open: true,
      proxy: {
        // ── Wrangler D1 / R2 (toggle with VITE_USE_WRANGLER=true) ───────────
        ...wranglerProxy,

        // ── External HRMS APIs (always proxied) ─────────────────────────────
        '/api/idms': {
          target: 'https://mobiledev.advanceagro.net',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/idms/, '/ws/api/idms'),
        },
        '/api/Face/GetImage': {
          target: 'https://wms.advanceagro.net',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/Face\/GetImage/, '/WSVIS/api/Face/GetImage'),
        },
        '/api/hrms': {
          target: 'https://api-idms.advanceagro.net',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/hrms/, '/hrms'),
        },
      },
    },
    build: {
      outDir: 'dist',
    },
  };
});

