import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifySessionToken, type SessionPayload } from "./session";

/** Server-only helper — reads and verifies the session cookie for the
 *  current request. Safe to call from any server component or route
 *  handler (never from a "use client" file). */
export async function getCurrentUser(): Promise<SessionPayload | null> {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
