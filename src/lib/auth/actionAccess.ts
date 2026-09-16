// The action-access checkpoint — a lightweight, session-free password gate
// for the app's few write/export actions (importing a report, submitting
// QA Audit numbers via Manual Entry, deleting an import, and downloading
// the Reports export). Everything else in the app is now plain, unlocked
// browsing — see middleware.ts, which used to require a full sign-in
// (email + shared password, via session.ts) just to VIEW any page and no
// longer does.
//
// Deliberately NOT the same mechanism as session.ts: this only ever proves
// "this browser recently typed the correct Lead/Manager password," not who
// someone is, so it doesn't need an email, a role, or a roster lookup —
// just a password check and a short-lived signed cookie so people aren't
// re-typing the password on every click. Uses the same Web Crypto
// (globalThis.crypto.subtle) approach session.ts already relies on, so it
// works identically in Edge and Node runtimes — but its own small HMAC
// helper here, rather than importing session.ts's, so this stays fully
// independent of the (still-present, now-optional) per-user login system.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { LEAD_PASSWORD } from "./sharedPasswords";

export const ACTION_ACCESS_COOKIE_NAME = "kyc_action_access";

/** How long a correct password unlocks actions for, in seconds — long
 *  enough to cover a workday of importing/exporting without re-prompting,
 *  short enough that a browser left open overnight doesn't stay unlocked
 *  indefinitely. Used both as the cookie's own maxAge and as the token's
 *  own embedded expiry check (belt and suspenders — a cookie maxAge alone
 *  can be edited client-side, the embedded check can't). */
export const ACTION_ACCESS_LIFETIME_SECONDS = 12 * 60 * 60; // 12 hours

const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(LEAD_PASSWORD), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return bytesToHex(new Uint8Array(signatureBuffer));
}

/** Plain string comparison is fine here: this checks a password typed into
 *  a form against a value only this server process holds, the same way
 *  /login's password check already works — there's no timing side-channel
 *  worth defending against that isn't already true of that existing
 *  check. */
export function checkActionPassword(candidate: string): boolean {
  return candidate === LEAD_PASSWORD;
}

/** Issues the cookie's VALUE only — the caller (the route handler) sets
 *  the actual cookie, so it controls httpOnly/secure/maxAge in one place
 *  (see /api/auth/action-access/route.ts). */
export async function signActionAccessToken(): Promise<string> {
  const issuedAt = Date.now().toString();
  const signature = await hmacHex(issuedAt);
  return `${issuedAt}.${signature}`;
}

export async function verifyActionAccessToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [issuedAtPart, signaturePart] = parts;
  if (!issuedAtPart || !signaturePart) return false;

  const issuedAt = Number(issuedAtPart);
  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > ACTION_ACCESS_LIFETIME_SECONDS * 1000) return false;

  const expectedSignature = await hmacHex(issuedAtPart);
  return expectedSignature === signaturePart;
}

/** Server-only guard for every route that imports, edits, deletes, or
 *  exports the team's data. Call this first, inside the route's try block,
 *  and return its result immediately if it's non-null — mirrors how
 *  reports/export/route.ts used to read getCurrentUser() before doing any
 *  work, just checking the action-access cookie above instead of a full
 *  session, since these routes no longer require signing in at all (see
 *  middleware.ts — deleted; there's no more blanket page gate). This is
 *  the REAL enforcement: the password prompt in PasswordGate.tsx is just
 *  the matching UI — without this check on each route, someone could call
 *  the API directly and skip the prompt entirely. */
export async function requireActionAccess(): Promise<NextResponse | null> {
  const token = cookies().get(ACTION_ACCESS_COOKIE_NAME)?.value;
  const ok = await verifyActionAccessToken(token);
  if (ok) return null;
  return NextResponse.json({ error: "Password required — unlock this page and try again." }, { status: 401 });
}
