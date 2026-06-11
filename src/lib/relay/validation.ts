/**
 * Validate base64 image sizes in request body.
 * If any image exceeds 1MB, returns validation result with error.
 */
export function validateBase64ImageSizes(body: any): { valid: boolean; error?: string } {
  if (!body || !body.messages || !Array.isArray(body.messages)) {
    return { valid: true };
  }

  const MAX_SIZE_BYTES = 1024 * 1024; // 1MB

  for (let i = 0; i < body.messages.length; i++) {
    const msg = body.messages[i];
    if (msg && Array.isArray(msg.content)) {
      for (let j = 0; j < msg.content.length; j++) {
        const part = msg.content[j];
        if (part && typeof part === 'object' && part.type === 'image_url' && part.image_url?.url) {
          const url: string = part.image_url.url;
          if (url.startsWith('data:')) {
            const commaIdx = url.indexOf(',');
            if (commaIdx !== -1) {
              const base64Data = url.slice(commaIdx + 1);
              // Calculate approximate size in bytes: base64 length * 0.75
              const approximateBytes = Math.ceil((base64Data.length * 3) / 4);
              if (approximateBytes > MAX_SIZE_BYTES) {
                const sizeInMB = (approximateBytes / (1024 * 1024)).toFixed(2);
                return {
                  valid: false,
                  error: `Base64 image size exceeds the limit of 1MB (current size: ${sizeInMB}MB).`
                };
              }
            }
          }
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Default cap for the Cloudflare request-size guard (10MB). Generous enough
 * for legitimate multi-modal requests (several images + text) while bounding
 * the oversized payloads that validateBase64ImageSizes used to reject.
 */
const DEFAULT_MAX_REQUEST_BYTES = 10 * 1024 * 1024;

function maxRequestBytes(): number {
  const raw = process.env.RELAY_MAX_REQUEST_BYTES;
  if (raw === undefined || raw.trim() === '') return DEFAULT_MAX_REQUEST_BYTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_MAX_REQUEST_BYTES;
  return parsed; // 0 disables the cap
}

/**
 * Cheap O(1) total request-size guard for Cloudflare Free.
 *
 * The precise per-image base64 scan (validateBase64ImageSizes) is O(body)
 * CPU, which CF Free's ~10ms budget can't afford on large requests. This
 * preserves equivalent abuse protection at constant cost by capping the
 * whole request size instead of scanning each image: an oversized inline
 * image still pushes the total body past the cap and is rejected before
 * relay. Coarser than the per-image limit by design.
 *
 * `rawByteLength` is the request text's character length (UTF-16 code units,
 * ≈ bytes for the base64/ASCII payloads that dominate large requests).
 * Pass the upstream Content-Length when available for an exact byte count.
 * Set RELAY_MAX_REQUEST_BYTES=0 to disable.
 */
export function validateRequestSize(rawByteLength: number): { valid: boolean; error?: string } {
  const cap = maxRequestBytes();
  if (cap > 0 && rawByteLength > cap) {
    const sizeInMB = (rawByteLength / (1024 * 1024)).toFixed(2);
    const capInMB = (cap / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Request body size (${sizeInMB}MB) exceeds the limit of ${capInMB}MB.`,
    };
  }
  return { valid: true };
}
