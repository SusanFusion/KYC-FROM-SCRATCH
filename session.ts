// Stateless, signed session tokens — deliberately NOT a database session.
// Verifying a token only needs AUTH_SECRET (an env var), so login/session
// checks work identically in Next.js middleware (Edge runtime) and in
// Node API routes/server components, and are completely unaffected by
// whether the data layer is running LocalRepository (in-memory) or
// SupabaseRepository — auth never depends on the data persistence story.
//
// As of the "no login wall for agents" change, this session type is used
// by Leads/Managers only (to unlock Data Import, Reports export, and
// recording penalties) — see recordUnlock.ts for the separate, lighter
// per-agent "view my QA Audit / penalties" unlock that everyone else uses
// instead of signing in at all.
import type { UserRole } from "./roster";
import { signJson, verifyJson } from "./crypto";

export const AUTH_COOKIE_NAME = "kyc_session";

export interface SessionPayload {
  email: string;
  name: string;
  role: UserRole;
  agentId: string | null;
  iat: number;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return signJson(payload);
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  const raw = await verifyJson(token);
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Partial<SessionPayload>;
  if (
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
}
