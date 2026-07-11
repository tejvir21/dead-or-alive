/** Decode JWT payload (no signature verification - trust your own server) */
export function decodeJWT(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const [, b64] = token.split('.');
    if (!b64) return null;
    const base64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=');
    return JSON.parse(atob(padded));
  } catch (_) { return null; }
}

/** ms remaining until token expiry, or null if unreadable */
export function msUntilExpiry(token) {
  const p = decodeJWT(token);
  if (!p?.exp) return null;
  return p.exp * 1000 - Date.now();
}

/** true if token is expired or expires within bufferMs (default 30s) */
export function isExpiringSoon(token, bufferMs = 30000) {
  const r = msUntilExpiry(token);
  return r === null || r <= bufferMs;
}
