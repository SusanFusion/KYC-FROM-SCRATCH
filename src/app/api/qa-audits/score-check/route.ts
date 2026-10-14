import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data/repository";
import { requireActionAccess } from "@/lib/auth/actionAccess";
import { refreshQaAuditPct } from "@/lib/qa/refreshQaAuditPct";
import { findQaScoreIssues } from "@/lib/qa/scoreCheck";
import { describeError } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET  /api/qa-audits/score-check?start=YYYY-MM-DD&end=YYYY-MM-DD[&agentId=]
//   Lists QA Audit scores that are not reflected on the scorecard for that
//   window (see lib/qa/scoreCheck.ts). Lead/Manager password required, like
//   every other QA route -- a locked browser simply gets 401 and the page
//   banner stays hidden.
//
// POST /api/qa-audits/score-check   { agentId, periodId }
//   Recalculates that agent+day's QA Audit % from their published audits --
//   the same thing "Re-publish" does, without touching the audit itself.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const denied = await requireActionAccess();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start") ?? "";
    const end = searchParams.get("end") ?? "";
    const agentId = searchParams.get("agentId") ?? undefined;
    if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
      return NextResponse.json({ error: "start and end must be YYYY-MM-DD." }, { status: 400 });
    }
    const issues = await findQaScoreIssues({ start, end, agentId });
    return NextResponse.json({ issues });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error while checking QA scores.", detail: describeError(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireActionAccess();
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as { agentId?: string; periodId?: string };
    if (!body.agentId || !body.periodId) {
      return NextResponse.json({ error: "agentId and periodId are required." }, { status: 400 });
    }

    // Only ever recalculate where there is a published, scorable audit to
    // recalculate FROM -- with none, refreshQaAuditPct would clear the score.
    const repo = await getRepository();
    const audits = await repo.getQaAudits({ agentId: body.agentId, periodId: body.periodId });
    const hasPublished = audits.some((a) => a.status === "published" && a.percentage !== null);
    if (!hasPublished) {
      return NextResponse.json({ error: "No published audit with a score for this agent and day, so there is nothing to recalculate." }, { status: 400 });
    }

    const { qaAuditPct, blendedFrom } = await refreshQaAuditPct(body.agentId, body.periodId);
    return NextResponse.json({ ok: true, qaAuditPct, blendedFrom });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error while recalculating.", detail: describeError(err) }, { status: 500 });
  }
}
