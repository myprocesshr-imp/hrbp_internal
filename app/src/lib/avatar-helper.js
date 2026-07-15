/**
 * Helper to dynamically load employee avatars from the HRMS face image API.
 *
 * Flow:
 * 1. Request the face image via proxy: /api/Face/GetImage?EmpID=...
 * 2. Verify the response actually contains image data (Content-Length > 0)
 *    — HRMS returns HTTP 200 with 0 bytes when no photo is registered.
 * 3. If Content-Length header is absent (chunked encoding), read the blob
 *    to check actual byte size before setting src.
 * 4. If any step fails or returns empty, trigger the onerror fallback (person icon).
 */

export async function loadAvatarForElement(imgElement, empId) {
  if (!empId || !imgElement || !imgElement.isConnected) return;

  // 🔍 DIAGNOSTIC: ดู Console เพื่อตรวจสอบว่า EmpID ที่ใช้คืออะไร
  console.log(`[Avatar] Requesting image for EmpID: "${empId}" → /api/Face/GetImage?CardID=${empId}`);

  try {
    // Step 1: Fetch image via Vite proxy (rewrites to /WSVIS/api/Face/GetImage?CardID=...)
    const imageUrl = `/api/Face/GetImage?CardID=${empId}`;
    const imgRes = await fetch(imageUrl);

    console.log(`[Avatar] Response for EmpID "${empId}": status=${imgRes.status}, content-type=${imgRes.headers.get('content-type')}, content-length=${imgRes.headers.get('content-length')}`);

    if (!imgRes.ok) {
      console.warn(`[Avatar] Image request for EmpID ${empId} returned ${imgRes.status}. Showing fallback.`);
      triggerFallback(imgElement);
      return;
    }


    // Step 2: Verify the response actually contains bytes.
    // HRMS returns HTTP 200 with 0 bytes when no photo is registered for this employee.
    // Note: some servers use chunked transfer encoding and omit Content-Length entirely,
    // so we fall back to reading the blob and checking its actual size.
    const contentLengthHeader = imgRes.headers.get('content-length');

    if (contentLengthHeader !== null) {
      // Header is present — trust it for a fast check (no need to read body)
      if (parseInt(contentLengthHeader, 10) === 0) {
        console.warn(`[Avatar] HRMS returned empty image (0 bytes) for EmpID: ${empId}. No photo registered.`);
        triggerFallback(imgElement);
        return;
      }
      // Non-zero Content-Length → set src and let the browser load it natively
      imgElement.src = imageUrl;
    } else {
      // Header absent (chunked encoding) → read the actual blob to check real byte size
      const blob = await imgRes.blob();
      if (blob.size === 0) {
        console.warn(`[Avatar] HRMS returned empty blob for EmpID: ${empId}. No photo registered.`);
        triggerFallback(imgElement);
        return;
      }
      // Valid image bytes — use an object URL so no second network request is made
      const objectUrl = URL.createObjectURL(blob);
      imgElement.src = objectUrl;
      // Revoke the object URL once the image finishes loading to free memory
      imgElement.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });
    }

  } catch (err) {
    console.error(`[Avatar] Failed to load avatar for EmpID ${empId}:`, err);
    triggerFallback(imgElement);
  }
}

function triggerFallback(imgElement) {
  if (imgElement && typeof imgElement.onerror === 'function') {
    imgElement.onerror();
  }
}
