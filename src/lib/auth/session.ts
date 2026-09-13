// Stateless, signed session tokens — deliberately NOT a database session.
// Verifying a token only needs AUTH_SECRET (an env var), so login/session
// checks work identically in Next.js middleware (Edge runtime) and in
// Node API routes/server components, and are completely unaffected by
// whether the data layer is running LocalRepository (in-memory) or
// SupabaseRepository — auth never depends on the data persistence story.
//
// Uses the Web Crypto API (globalThis.crypto.subtle) rather than Node's
// `crypto` module or a JWT library: subtle crypto is available in both the
// Edge runtime (middleware) and Node 20+ (this app's minimum), so one
// implementation covers both without adding a dependency.
import type { UserRole } from "./roster";

export const AUTH_COOKIE_NAME = "kyc_session";

export interface SessionPayload {
  email: string;
  name: string;
  role: UserRole;
  agentId: string | null;
  iat: number;
}

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

export async function signSession(payload: SessionPayload): Promise<string> {
  const key = await getHmacKey();
  const payloadPart = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadPart));
  const signaturePart = bytesToBase64Url(new Uint8Array(signatureBuffer));
  return `${payloadPart}.${signaturePart}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
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
    const payload = JSON.parse(json) as Partial<SessionPayload>;
    if (
      !payload ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      (payload.role !== "agent" && payload.role !== "lead")
    ) {
      return null;
    }
    return {
      email: payload.email,
      name: payload.name,
      role: payload.role,
      agentId: payload.agentId ?? null,
      iat: typeof payload.iat === "number" ? payload.iat : 0,
    };
  } catch {
    return null;
  }
}
