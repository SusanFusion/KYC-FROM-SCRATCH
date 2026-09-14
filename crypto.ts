// Generic signed-JSON helpers shared by every cookie this app issues
// (the full login session, and the lighter-weight "record unlock" cookie).
// Uses the Web Crypto API (globalThis.crypto.subtle) rather than Node's
// `crypto` module or a JWT library: subtle crypto is available in both the
// Edge runtime (middleware) and Node 20+ (this app's minimum), so one
// implementation covers both without adding a dependency. Extracted out of
// session.ts so a second, unrelated kind of signed cookie doesn't have to
// duplicate the base64url/HMAC plumbing.
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Falls back to a fixed dev secret so the app still runs zero-config, same
 *  philosophy as the LocalRepository fallback — but this should always be
 *  overridden with a real AUTH_SECRET in production (see .env.example). */
function getSecret(): string {
  return process.env.AUTH_SECRET || "kyc-from-scratch-dev-secret-change-me-in-production";
}

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(getSecret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signJson(payload: unknown): Promise<string> {
  const key = await getHmacKey();
  const payloadPart = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadPart));
  const signaturePart = bytesToBase64Url(new Uint8Array(signatureBuffer));
  return `${payloadPart}.${signaturePart}`;
}

/** Returns the parsed (but NOT shape-validated) JSON payload, or null if the
 *  token is missing, malformed, or its signature doesn't match — callers
 *  are responsible for validating the shape of whatever comes back. */
export async function verifyJson(token: string | undefined | null): Promise<unknown | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const payloadPart = parts[0];
  const signaturePart = parts[1];
  if (!payloadPart || !signaturePart) return null;

  try {
    const key = await getHmacKey();
    const expectedSignatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadPart));
    const expectedSignaturePart = bytesToBase64Url(new Uint8Array(expectedSignatureBuffer));
    if (expectedSignaturePart !== signaturePart) return null;

    const json = decoder.decode(base64UrlToBytes(payloadPart));
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}
