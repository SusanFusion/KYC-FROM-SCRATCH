// The per-agent "view my QA Audit + my penalty entries" unlock.
//
// General browsing (Dashboard, Team Performance, Rankings, Scorecards,
// Trends, Reports, ...) needs no sign-in at all — see middleware.ts. But an
// agent's QA Audit detail and the specific penalty entries on THEIR
// scorecard are still sensitive, so viewing either requires entering the
// shared team password once for that specific agent. A signed, session
// (non-persistent) cookie remembers which agent IDs have already been
// unlocked this browser session, scoped one agent at a time — entering the
// password on Abigael's scorecard does not also reveal Yuri's, since the
// password only proves "someone who knows it is looking," not who they
// are. Leads/Managers (a real signed-in session, see session.ts) always
// see every agent's QA Audit and penalties regardless of this cookie.
import { cookies } from "next/headers";
import { signJson, verifyJson } from "./crypto";

export const RECORD_UNLOCK_COOKIE_NAME = "kyc_unlocked_records";

interface RecordUnlockPayload {
  agentIds: string[];
  iat: number;
}

function parsePayload(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const ids = (raw as Partial<RecordUnlockPayload>).agentIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

/** Reads and verifies the current unlock cookie server-side. */
export async function getUnlockedAgentIds(): Promise<string[]> {
  const token = cookies().get(RECORD_UNLOCK_COOKIE_NAME)?.value;
  const raw = await verifyJson(token);
  return parsePayload(raw);
}

/** Given the currently-unlocked set (from a request's own cookie, since
 *  Route Handlers can't rely on next/headers' cookies() for reading in
 *  every runtime the same way middleware can) and a newly-unlocked agent
 *  id, returns the new signed cookie value to set. */
export async function signUnlockedAgentIds(existingToken: string | undefined | null, newAgentId: string): Promise<string> {
  const raw = await verifyJson(existingToken);
  const current = parsePayload(raw);
  const next = current.includes(newAgentId) ? current : [...current, newAgentId];
  const payload: RecordUnlockPayload = { agentIds: next, iat: Date.now() };
  return signJson(payload);
}

/** The shared password that unlocks a specific agent's QA Audit / penalty
 *  view. Reuses the same env var that used to gate the (now-removed)
 *  agent login wall — same secret, new purpose. */
export function getRecordUnlockPassword(): string {
  return process.env.AGENT_SHARED_PASSWORD || "KYCAgent#2026";
}
