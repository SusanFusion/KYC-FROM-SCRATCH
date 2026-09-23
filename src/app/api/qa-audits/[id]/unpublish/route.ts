import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data/repository";
import { requireActionAccess } from "@/lib/auth/actionAccess";
import { refreshQaAuditPct } from "@/lib/qa/refreshQaAuditPct";
import { describeError } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * POST /api/qa-audits/[id]/unpublish
 *
 * The inverse of publish: sets this audit back to "submitted" (the record
 * is kept, it's just no longer counted toward the scorecard) and
 * immediately recomputes the agent+period's qaAuditPct the exact same way
 * Delete does (see refreshQaAuditPct.ts) -- re-blend whatever else is
 * still published, fall back to the last Manual Entry/PDF import value if
 * nothing else is, or clear to null if there's genuinely nothing.
 *
 * This is the action that actually changes the scorecard number without
 * losing the audit record -- Delete (see [id]/route.ts) runs the same
 * recompute and additionally removes the record, so deleting a published
 * audit behaves exactly "as good as unpublished" (per Susan), whether or
 * not you unpublish it first.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const denied = await requireActionAccess();
  if (denied) return denied;

  try {
    const repo = await getRepository();
    const audit = await repo.getQaAuditById(params.id);
    if (!audit) return NextResponse.json({ error: "Audit not found." }, { status: 404 });
    if (audit.status !== "published") {
      return NextResponse.json({ error: "This audit isn't published, so there's nothing to unpublish." }, { status: 400 });
    }

    await repo.setQaAuditStatus(audit.id, "submitted");

    const { qaAuditPct, blendedFrom, restoredFromImport } = await refreshQaAuditPct(audit.agentId, audit.periodId);

    return NextResponse.json({
      audit: { ...audit, status: "submitted" },
      qaAuditPct,
      blendedFrom,
      restoredFromImport,
    });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error while unpublishing the audit.", detail: describeError(err) }, { status: 500 });
  }
}
