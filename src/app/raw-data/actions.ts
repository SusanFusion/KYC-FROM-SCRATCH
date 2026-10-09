"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getRepository } from "@/lib/data/repository";
import { ACTION_ACCESS_COOKIE_NAME, verifyActionAccessToken } from "@/lib/auth/actionAccess";
import { ROSTER } from "@/lib/auth/roster";
import { applyRawEntryEdit, applyRawEntryDelete } from "@/lib/data/rawDataEdit";
import { listRawDataChanges } from "@/lib/data/rawDataChangeLog";
import type { RawDataChange } from "@/lib/data/rawDataFields";

// Same pattern as import/actions.ts and penalties/actions.ts: the shared
// Lead/Manager password cookie is the REAL enforcement (a server action can be
// called directly, so the PasswordGate in the UI alone would not be enough).
async function checkActionAccess(): Promise<string | null> {
  const token = cookies().get(ACTION_ACCESS_COOKIE_NAME)?.value;
  const ok = await verifyActionAccessToken(token);
  return ok ? null : "Password required — unlock this section and try again.";
}

/** Who is allowed to be named as the person making a change: the Leads/Managers on the roster. */
function isKnownLead(name: string): boolean {
  return ROSTER.some((r) => r.role === "lead" && r.name === name);
}

// Every score is derived fresh from raw data on read (see query.ts), so after
// a change all that's needed is telling each page that reads it to refetch.
function refreshEverywhere(agentId: string) {
  for (const path of ["/raw-data", "/import", "/team-performance", "/trends", "/mtd", "/quarter", "/", "/rankings", "/reports", "/scorecards"]) {
    revalidatePath(path);
  }
  revalidatePath(`/scorecards/${agentId}`);
}

export type RawActionResult = { ok: true } | { ok: false; error: string };

export async function updateRawEntryAction(args: {
  agentId: string;
  date: string;
  values: Record<string, number | null>;
  reason: string;
  changedBy: string;
}): Promise<RawActionResult> {
  const accessError = await checkActionAccess();
  if (accessError) return { ok: false, error: accessError };
  if (!isKnownLead(args.changedBy)) return { ok: false, error: "Pick who is making this change from the list." };

  const repo = await getRepository();
  const result = await applyRawEntryEdit(repo, args);
  if (!result.ok) return result;
  refreshEverywhere(args.agentId);
  return { ok: true };
}

export async function deleteRawEntryAction(args: {
  agentId: string;
  date: string;
  reason: string;
  changedBy: string;
}): Promise<RawActionResult> {
  const accessError = await checkActionAccess();
  if (accessError) return { ok: false, error: accessError };
  if (!isKnownLead(args.changedBy)) return { ok: false, error: "Pick who is making this change from the list." };

  const repo = await getRepository();
  const result = await applyRawEntryDelete(repo, args);
  if (!result.ok) return result;
  refreshEverywhere(args.agentId);
  return { ok: true };
}

export async function listRawDataChangesAction(): Promise<{ ok: true; changes: RawDataChange[] } | { ok: false; error: string }> {
  const accessError = await checkActionAccess();
  if (accessError) return { ok: false, error: accessError };
  try {
    return { ok: true, changes: await listRawDataChanges() };
  } catch (err) {
    return { ok: false, error: `Couldn't load the change history. ${err instanceof Error ? err.message : ""}`.trim() };
  }
}
