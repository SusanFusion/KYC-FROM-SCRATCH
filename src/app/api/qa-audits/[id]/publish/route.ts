import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data/repository";
import { commitImportRows } from "@/lib/data/commitImportRows";
import { requireActionAccess } from "@/lib/auth/actionAccess";
import { describeError } from "@/lib/utils";
import { QA_AUDIT_TYPE_LABELS } from "@/lib/qa/auditDefinitions";

export const runtime = "nodejs";

/**
 * POST /api/qa-audits/[id]/publish
 *
 * Publishing is what makes an audit's score count toward the agent's actual
 * scorecard (the "publish the score to reflect in the overall individual
 * scorecard" requirement). It deliberately does NOT introduce a new way of
 * writing qaAuditPct: it marks this audit published, then blends together
 * the percentage of every PUBLISHED audit for this same agent+period
 * (across whichever audit types exist — right now just Applications; once
 * Emails/Chats audits exist, publishing one of those blends in alongside
 * whatever else is already published for that period) into a single
 * average, and writes THAT number through commitImportRows() — the exact
 * same merge-safe path a PDF import or Manual Entry already uses to set
 * qaAuditPct. That's what keeps this one flat "QA Audit %" field (see
 * lib/scoring/types.ts) working completely unchanged everywhere it's
 * already read (Scorecards, Dashboard, Trends, Rankings, Reports) — audits
 * are just a new, structured way of arriving at the same number.
 *
 * Safe to call again later (e.g. after submitting/publishing a second
 * audit for the same agent+period) — it always recomputes the blend from
 * scratch off whatever's currently published, rather than accumulating.
 * Note: deleting a published audit does NOT automatically re-blend — if
 * that happens, publish another remaining audit for that agent+period (or
 * re-submit a corrected one) to refresh the number.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const denied = await requireActionAccess();
  if (denied) return denied;

  try {
    const repo = await getRepository();
    const audit = await repo.getQaAuditById(params.id);
    if (!audit) return NextResponse.json({ error: "Audit not found." }, { status: 404 });

    await repo.setQaAuditStatus(audit.id, "published");

    const published = await repo.getQaAudits({ agentId: audit.agentId, periodId: audit.periodId });
    const scored = published.filter((a) => a.status === "published" && a.percentage !== null);

    if (scored.length === 0) {
      // Every published audit for this agent+period (including the one just
      // published) had nothing applicable to score (all N/A) — nothing to
      // write onto the scorecard yet.
      return NextResponse.json({
        audit: { ...audit, status: "published" },
        blendedQaAuditPct: null,
        message: "Published, but no audit for this agent/period has a scorable percentage yet — the scorecard's QA Audit % is unchanged.",
      });
    }

    const blended = scored.reduce((sum, a) => sum + (a.percentage as number), 0) / scored.length;
    const roundedBlend = Math.round(blended * 10) / 10;

    const { record, rows } = await repo.createImport(
      {
        fileName: `QA Audit publish — ${QA_AUDIT_TYPE_LABELS[audit.auditType]} (${audit.agentName})`,
        uploadedAt: new Date().toISOString(),
        periodLabel: null,
        status: "pending_review",
        rowCount: 1,
      },
      [
        {
          agentNameRaw: audit.agentName,
          matchedAgentId: audit.agentId,
          metricKey: "qaAuditPct",
          rawValue: String(roundedBlend),
          parsedValue: roundedBlend,
          status: "extracted",
        },
      ]
    );

    const result = await commitImportRows({
      importId: record.id,
      rows,
      endDateIso: audit.auditDate,
      targetPeriodId: audit.periodId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      audit: { ...audit, status: "published" },
      blendedQaAuditPct: roundedBlend,
      blendedFrom: scored.length,
    });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error while publishing the audit.", detail: describeError(err) }, { status: 500 });
  }
}
