"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getRepository } from "@/lib/data/repository";
import type { PenaltyCode } from "@/lib/scoring/types";
import { ACTION_ACCESS_COOKIE_NAME, verifyActionAccessToken } from "@/lib/auth/actionAccess";

/** requireActionAccess() in actionAccess.ts returns a NextResponse, built
 *  for route handlers -- a "use server" action instead returns the same
 *  plain {ok, error} shape this action already uses, so this checks the
 *  identical cookie/token directly rather than reusing that helper as-is.
 *  The PasswordGate wrapping "Record a Penalty" on the Penalties page is
 *  the matching UI prompt; this is the real, server-side enforcement --
 *  same relationship every other gated action in the app already has. */
async function checkActionAccess(): Promise<string | null> {
  const token = cookies().get(ACTION_ACCESS_COOKIE_NAME)?.value;
  const ok = await verifyActionAccessToken(token);
  return ok ? null : "Password required — unlock this section and try again.";
}

export async function addPenaltyAction(formData: FormData) {
  const accessError = await checkActionAccess();
  if (accessError) return { ok: false, error: accessError };

  const agentId = String(formData.get("agentId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const code = String(formData.get("code") ?? "") as PenaltyCode;
  const count = Number(formData.get("count") ?? 1) || 1;
  const note = String(formData.get("note") ?? "");
  const occurredOn = String(formData.get("occurredOn") ?? new Date().toISOString().slice(0, 10));
  const recordedBy = String(formData.get("recordedBy") ?? "").trim();

  if (!agentId || !periodId || !code) return { ok: false, error: "Missing required fields." };
  if (!recordedBy) return { ok: false, error: 'Enter your name in "Recorded by" before saving.' };

  const repo = await getRepository();
  await repo.addPenalty({ agentId, periodId, code, count, note: note || undefined, occurredOn, recordedBy });

  revalidatePath("/penalties");
  revalidatePath("/rankings");
  revalidatePath(`/scorecards/${agentId}`);
  return { ok: true };
}

export async function deletePenaltyAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const agentId = String(formData.get("agentId") ?? "");

  if (!id) return { ok: false, error: "Missing penalty id." };

  const repo = await getRepository();
  await repo.deletePenalty(id);

  // Scores/rankings are always derived fresh from raw data (see
  // src/lib/data/query.ts), so deleting the underlying penalty record here
  // is all that's needed for it to stop affecting that agent's individual
  // score, their Scorecard breakdown, and the Rankings board — nothing to
  // recalculate or backfill separately.
  revalidatePath("/penalties");
  revalidatePath("/rankings");
  if (agentId) revalidatePath(`/scorecards/${agentId}`);
  return { ok: true };
}
