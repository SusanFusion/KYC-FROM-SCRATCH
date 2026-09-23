import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data/repository";
import { requireActionAccess } from "@/lib/auth/actionAccess";
import { refreshQaAuditPct } from "@/lib/qa/refreshQaAuditPct";
import { describeError } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * POST /api/qa-audits/[id]/publish
 *
 * Publishing is what makes an audit's score count toward the agent's actual
 * scorecard (the "publish the score to reflect in the overall individual
 * scorecard" requirement). It deliberately does NOT introduce a new way of
 * writing qaAuditPct: it marks this audit published, then — once there's
 * at least one published audit for this agent+period with a scorable
 * percentage — hands off to refreshQaAuditPct() to blend together the
 * percentage of every PUBLISHED audit for this same agent+period (across
 * whichever audit types exist — right now just Applications; once
 * Emails/Chats audits exist, publishing one of those blends in alongside
 * whatever else is already published for that period) into a single
 * average and write it onto the scorecard. That's what keeps this one flat
 * "QA Audit %" field (see lib/scoring/types.ts) working completely
 * unchanged everywhere it's already read (Scorecards, Dashboard, Trends,
 * Rankings, Reports) — audits are just a new, structured way of arriving
 * at the same number.
 *
 * refreshQaAuditPct() is the same helper the DELETE route now calls after
 * removing an audit (see [id]/route.ts), so the two paths that can change
 * which audits count toward the blend — publishing one, deleting one —
 * always agree on what the resulting number should be. Deleting a
 * published audit re-blends automatically now; no manual "republish
 * another audit to refresh it" workaround needed any more.
 *
 * Safe to call again later (e.g. after submitting/publishing a second
 * audit for the same agent+period) — it always recomputes the blend from
 * scratch off whatever's currently published, rather than accumulating.
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
      // Every published audit for this agent+period (including the one
      // just published) had nothing applicable to score (all N/A) —
      // nothing to write onto the scorecard yet, and whatever qaAuditPct
      // is already there (if anything) is left exactly as-is.
      return NextResponse.json({
        audit: { ...audit, status: "published" },
        blendedQaAuditPct: null,
        message: "Published, but no audit for this agent/period has a scorable percentage yet — the scorecard's QA Audit % is unchanged.",
      });
    }

    const { qaAuditPct, blendedFrom } = await refreshQaAuditPct(audit.agentId, audit.periodId);

    return NextResponse.json({
      audit: { ...audit, status: "published" },
      blendedQaAuditPct: qaAuditPct,
      blendedFrom,
    });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error while publishing the audit.", detail: describeError(err) }, { status: 500 });
  }
}
