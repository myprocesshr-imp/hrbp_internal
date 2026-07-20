/**
 * Unified Certificate Render Engine
 *
 * Consolidates placeholder substitution, HTML escaping, signature rendering,
 * and template HTML parsing that was previously duplicated across:
 *   - certificate-builder.js (fillTemplatePlaceholders, signatureImgHtml, parseTemplateHtml)
 *   - templates.js (parseTemplatePlaceholders, signatureImgHtml, escapeHtmlAttr)
 *   - admin-templates.js (indirectly via template builders)
 *
 * Usage:
 *   import { fillPlaceholders, signatureImgHtml, parseTemplateHtml, escapeHtmlAttr } from '../lib/cert-renderer.js';
 */

// ── HTML utilities ─────────────────────────────────────────────────────────

/**
 * Escape HTML attribute value (prevents XSS in dynamic attribute strings).
 */
export function escapeHtmlAttr(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * Generate a safe <img> tag for a signature.
 * Handles data URLs, API paths, and R2 keys.
 */
export function signatureImgHtml(sigSrc, alt = 'Signature') {
  if (!sigSrc) return '';
  const safeSrc = String(sigSrc).replace(/"/g, '&quot;');
  const safeAlt = escapeHtmlAttr(alt);
  return `<img src="${safeSrc}" alt="${safeAlt}" style="max-height:100%;max-width:100%;object-fit:contain;" />`;
}

/**
 * Resolve a signature source to an image URL.
 * - data: URLs → returned as-is
 * - http:/https: URLs → returned as-is
 * - /api/... paths → returned as-is
 * - R2 keys (signatures/xxx) → converted to /api/signatures/{userId}
 *
 * @param {string} raw - Raw signature value from user record or signature cache
 * @param {string} userId - User ID for R2 key resolution
 * @returns {string} Resolved image URL
 */
export function resolveSignatureUrl(raw, userId) {
  if (!raw) return '';
  if (raw.startsWith('data:') || raw.startsWith('http') || raw.startsWith('/')) return raw;
  return `/api/signatures/${userId}`;
}

// ── Template placeholder substitution ──────────────────────────────────────

/**
 * Replace all {{key}} placeholders in an HTML string with values from reps.
 *
 * @param {string} html - Template HTML containing {{placeholders}}
 * @param {object} reps - Key → value mapping. Missing keys are replaced with empty string.
 * @returns {string} Rendered HTML
 */
export function fillPlaceholders(html, reps) {
  let out = html;
  Object.keys(reps).forEach(k => {
    out = out.replace(new RegExp(`{{${k}}}`, 'g'), reps[k] ?? '');
  });
  return out;
}

/**
 * Parse template HTML into its <style> blocks and <body> content.
 *
 * @param {string} html - Full template HTML string
 * @returns {{ styles: string, bodyContent: string }}
 */
export function parseTemplateHtml(html) {
  const styleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  const styles = styleBlocks.map(s => s.replace(/<\/?style[^>]*>/gi, '')).join('\n');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1].trim() : html;
  return { styles, bodyContent };
}

// ── Default certificate CSS constants ──────────────────────────────────────

export const CERT_PRINT_SINGLE_PAGE_CSS = `<style id="cb-print-single-page">
@page { size: A4; margin: 0; }
html, body { margin: 0 !important; padding: 0 !important; width: 210mm !important; height: 297mm !important; overflow: hidden !important; }
.cert-page, .page {
  width: 210mm !important;
  height: 297mm !important;
  min-height: 297mm !important;
  max-height: 297mm !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
  page-break-inside: avoid !important;
  page-break-after: avoid !important;
  padding: 20mm 25mm 14mm !important;
  display: flex !important;
  flex-direction: column !important;
}
.body-text, .body { flex: 0 0 auto !important; min-height: 0 !important; margin-bottom: 0 !important; }
.signature-area, .sig-area { margin-top: 8mm !important; margin-bottom: 0 !important; padding-top: 0 !important; flex-shrink: 0 !important; }
.footer, .cb-cert-footer, .ftr { margin-top: auto !important; flex-shrink: 0 !important; page-break-inside: avoid !important; }
.doc-title { margin-top: 6mm !important; margin-bottom: 8mm !important; }
.purpose-line { margin-top: 6mm !important; }
</style>`;

export const CERT_FINAL_OUTPUT_CSS = `<style id="cb-final-output">
#cb-rmk-text, #cb-issue-date, #cb-mgr-name, #cb-mgr-display, #cb-mgr-pos,
#cb-header-hr-phone, #cb-off-phone, #cb-off-email, .cb-off-print-name,
#cb-emp-salary, input#cb-emp-salary {
  color: #1a1a1a !important;
  border: none !important;
  border-bottom: none !important;
  background: transparent !important;
  outline: none !important;
  box-shadow: none !important;
  text-decoration: none !important;
  cursor: default !important;
}
#cb-mgr-display, #cb-mgr-name { font-weight: 700 !important; }
.cb-off-select-visible { color: #1a1a1a !important; border: none !important; }
</style>`;

/**
 * Finalize certificate HTML for print output:
 * - Replace selects with plain text
 * - Strip edit chrome (blue dashed borders, contenteditable, etc.)
 * - Inject print CSS
 * - Place signature image
 *
 * @param {string} html - Raw certificate HTML
 * @param {object} opts
 * @param {string} opts.offName - HR officer name to replace select with
 * @param {string} opts.sigSrc - Signature image URL
 * @returns {string} Cleaned print-ready HTML
 */
export function finalizeCertificateHtml(html, { offName = '', sigSrc = '' } = {}) {
  let out = html;
  const safeName = escapeHtmlAttr(offName);

  out = out.replace(
    /<select[^>]*\bid="cb-off-select"[^>]*>[\s\S]*?<\/select>/gi,
    `<span class="cb-off-print-name" style="font-weight:700;color:#1a1a1a;">${safeName}</span>`
  );
  out = out.replace(
    /<select[^>]*\bid="cb-outer-off-select"[^>]*>[\s\S]*?<\/select>/gi,
    `<span class="cb-off-print-name" style="font-weight:700;color:#1a1a1a;">${safeName}</span>`
  );
  out = out.replace(/<select[^>]*\bid="cb-mgr-select"[^>]*>[\s\S]*?<\/select>/gi, '');
  out = out.replace(/<select[^>]*\bid="cb-rmk-select"[^>]*>[\s\S]*?<\/select>/gi, '');
  out = out.replace(/<select[^>]*\bid="cb-header-hr-select"[^>]*>[\s\S]*?<\/select>/gi, '');

  if (sigSrc) {
    const sigHtml = signatureImgHtml(sigSrc);
    out = out.replace(
      /(<div[^>]*\bid="cb-sig-box"[^>]*>)([\s\S]*?)(<\/div>)/i,
      `$1${sigHtml}$3`
    );
  }

  out = out.replace(/\scontenteditable="true"/gi, '');
  out = out.replace(/\stitle="[^"]*(?:คลิก|Click|เลือก|Select|แก้ไข|edit)[^"]*"/gi, '');

  const editIds = 'cb-rmk-text|cb-issue-date|cb-mgr-display|cb-header-hr-phone|cb-emp-salary|cb-mgr-name';
  out = out.replace(
    new RegExp(`(<[a-z][a-z0-9]*[^>]*\\bid="(?:${editIds})"[^>]*)\\sstyle="[^"]*"`, 'gi'),
    '$1'
  );

  out = out.replace(
    /<div[^>]*\bid="cb-mgr-display"[^>]*>([\s\S]*?)<\/div>/gi,
    (_match, inner) => {
      const nameMatch = inner.match(/id="cb-mgr-name"[^>]*>([\s\S]*?)<\//i);
      const name = nameMatch ? nameMatch[1].trim() : inner.replace(/<[^>]+>/g, '').replace(/[()&nbsp;\s]/g, ' ').trim();
      return `<div style="font-size:16pt;font-weight:700;color:#1a1a1a;">(&nbsp;${name}&nbsp;)</div>`;
    }
  );

  out = out.replace(
    /<input[^>]*\bid="cb-emp-salary"[^>]*value="([^"]*)"[^>]*\/?>/gi,
    '<span style="font-weight:700;color:#1a1a1a;">$1</span>'
  );

  out = out.replace(/style="([^"]*)"/gi, (match, styles) => {
    if (!/1a73e8|dashed|e8f0fe/i.test(styles)) return match;
    let cleaned = styles
      .replace(/border[^;]*dashed[^;]*;?/gi, '')
      .replace(/border-bottom[^;]*;?/gi, '')
      .replace(/color\s*:\s*#?1a73e8[^;]*;?/gi, 'color:#1a1a1a;')
      .replace(/background(?:-color)?\s*:\s*#?e8f0fe[^;]*;?/gi, 'background:transparent;')
      .replace(/cursor\s*:\s*(?:pointer|text)[^;]*;?/gi, '')
      .replace(/outline[^;]*;?/gi, '')
      .replace(/;\s*;/g, ';')
      .trim();
    if (cleaned.endsWith(';')) cleaned = cleaned.slice(0, -1);
    return cleaned ? `style="${cleaned}"` : '';
  });

  const injectStyles = `${CERT_PRINT_SINGLE_PAGE_CSS}${CERT_FINAL_OUTPUT_CSS}`;
  if (!out.includes('cb-final-output')) {
    if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `${injectStyles}</head>`);
    } else if (/<body[^>]*>/i.test(out)) {
      out = out.replace(/<body([^>]*)>/i, `<body$1>${injectStyles}`);
    } else {
      out = injectStyles + out;
    }
  }

  return out;
}