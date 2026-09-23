import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data/repository";
import { requireActionAccess } from "@/lib/auth/actionAccess";
import { refreshQaAuditPct } from "@/lib/qa/refreshQaAuditPct";
import { describeError } from "@/lib/utils";

export const runtime = "nodejs";

// GET    /api/qa-audits/[id]  — full confidential record, for the detail view.
// DELETE /api/qa-audits/[id]  — removes a mistaken/duplicate audit entirely,
//        then refreshes the scorecard's qaAuditPct for that agent+period so
//        it never reflects a now-deleted audit — see refreshQaAuditPct.ts.
//        Deleting a published audit re-blends whatever else is still
//        published for that agent+period (or clears the score back to null
//        if nothing else is), deleting an unpublished one is a harmless
//        no-op recompute (it was never part of the blend to begin with).

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await requireActionAccess();
  if (denied) return denied;

  try {
    const repo = await getRepository();
    const audit = await repo.getQaAuditById(params.id);
    if (!audit) return NextResponse.json({ error: "Audit not found." }, { status: 404 });
    return NextResponse.json({ audit });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error while loading the audit.", detail: describeError(err) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const denied = await requireActionAccess();
  if (denied) return denied;

  try {
    const repo = await getRepository();
    const audit = await repo.getQaAuditById(params.id);
    if (!audit) return NextResponse.json({ error: "Audit not found — it may have already been deleted." }, { status: 404 });

    await repo.deleteQaAudit(params.id);

    const { qaAuditPct, blendedFrom } = await refreshQaAuditPct(audit.agentId, audit.periodId);

    return NextResponse.json({ ok: true, qaAuditPct, blendedFrom });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error while deleting the audit.", detail: describeError(err) }, { status: 500 });
  }
}
