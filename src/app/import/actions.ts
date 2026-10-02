"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getRepository } from "@/lib/data/repository";
import { ACTION_ACCESS_COOKIE_NAME, verifyActionAccessToken } from "@/lib/auth/actionAccess";

/** Same pattern as src/app/penalties/actions.ts's own copy of this helper --
 *  requireActionAccess() in actionAccess.ts returns a NextResponse, built
 *  for route handlers, so a "use server" action checks the identical
 *  cookie/token directly instead and returns the plain {ok, error} shape
 *  this action already uses. */
async function checkActionAccess(): Promise<string | null> {
  const token = cookies().get(ACTION_ACCESS_COOKIE_NAME)?.value;
  const ok = await verifyActionAccessToken(token);
  return ok ? null : "Password required — unlock this section and try again.";
}

/** Deletes one agent's single KPI record for one period (Data Import page
 *  only — see page.tsx's canDeleteRawMetric, which hides this control
 *  unless the signed-in user is a Lead/Auditor, matching the Penalties
 *  page's existing convention). The shared Lead/Manager password check
 *  above is the REAL enforcement (this route-level gate can't be bypassed
 *  by calling the action directly); the role check is a visibility nicety
 *  layered on top, same relationship as everywhere else this pattern is
 *  used. */
export async function deleteRawMetricAction(formData: FormData) {
  const accessError = await checkActionAccess();
  if (accessError) return { ok: false, error: accessError };

  const agentId = String(formData.get("agentId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  if (!agentId || !periodId) return { ok: false, error: "Missing agent or period." };

  const repo = await getRepository();
  await repo.deleteRawMetric(agentId, periodId);

  // Every score is always derived fresh from raw data on read (see
  // src/lib/data/query.ts), so removing the underlying performance_entries
  // row here is all that's needed -- nothing cached to recalculate, just
  // tell every page that reads it to refetch.
  revalidatePath("/import");
  revalidatePath("/team-performance");
  revalidatePath("/trends");
  revalidatePath("/mtd");
  revalidatePath("/");
  revalidatePath("/rankings");
  revalidatePath("/reports");
  revalidatePath(`/scorecards/${agentId}`);
  return { ok: true };
}
