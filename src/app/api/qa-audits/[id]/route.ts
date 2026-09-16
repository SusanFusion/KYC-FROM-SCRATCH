import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data/repository";
import { requireActionAccess } from "@/lib/auth/actionAccess";
import { describeError } from "@/lib/utils";

export const runtime = "nodejs";

// GET    /api/qa-audits/[id]  — full confidential record, for the detail view.
// DELETE /api/qa-audits/[id]  — removes a mistaken/duplicate audit entirely.
//
// Deleting a PUBLISHED audit does not touch the qaAuditPct it already wrote
// onto the agent's scorecard — republish another remaining audit (or submit
// a corrected one and publish that) to update it. This mirrors Data
// Import's own delete: removing the audit-trail record doesn't retroactively
// undo whatever it already committed.

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
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error while deleting the audit.", detail: describeError(err) }, { status: 500 });
  }
}
