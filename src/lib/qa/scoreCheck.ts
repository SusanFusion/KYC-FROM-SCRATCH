// Finds QA Audit scores that exist but are NOT reflected on a scorecard, so a
// Lead can see it instead of having to compare the QA Audit column against
// QA History by eye.
//
// How a QA score reaches a scorecard (see publish/route.ts and
// refreshQaAuditPct.ts): publishing an audit averages every PUBLISHED audit
// for that agent + day and copies the result onto that day's KPI record
// (qaAuditPct). Every scorecard, ranking and report then reads that copied
// number. Two things can leave a real audit out of the scorecard:
//
//   - "not_calculated": the audit is published, but the day's record has no
//     QA % (or a different one) -- e.g. the record was deleted or replaced
//     after publishing. Re-publishing / recalculating fixes it.
//   - "not_published": the audit was submitted but never published, so by
//     design it does not count yet. A Lead has to publish it.
//
// Pure server-side logic; the route handlers and the page banner call it.

import { getRepository } from "@/lib/data/repository";

export interface QaScoreIssue {
  kind: "not_calculated" | "not_published";
  agentId: string;
  agentName: string;
  periodId: string;
  /** The day's scorecard record the audit is filed against, YYYY-MM-DD. */
  date: string;
  /** The dates on the audits themselves (the "Audit date" typed when each one
   *  was submitted), YYYY-MM-DD, oldest first, one entry per distinct date.
   *  This is what the banner shows for a not_published audit. */
  auditDates: string[];
  /** Audits involved (published ones for not_calculated, submitted ones for not_published). */
  auditCount: number;
  /** not_calculated only: what the published audits average to. */
  expectedPct: number | null;
  /** not_calculated only: what the scorecard currently holds (null = nothing). */
  currentPct: number | null;
}

/** Same rounding refreshQaAuditPct uses, so "expected" is exactly what a
 *  recalculation would write. */
function blend(percentages: number[]): number {
  return Math.round((percentages.reduce((s, p) => s + p, 0) / percentages.length) * 10) / 10;
}

export async function findQaScoreIssues(opts: { start: string; end: string; agentId?: string }): Promise<QaScoreIssue[]> {
  const repo = await getRepository();
  const [periods, audits] = await Promise.all([repo.getPeriods(), repo.getQaAudits(opts.agentId ? { agentId: opts.agentId } : undefined)]);

  // Only single-day periods count (that is what scorecards aggregate), and
  // only those inside the window being viewed.
  const periodById = new Map(
    periods.filter((p) => p.startDate === p.endDate && p.startDate >= opts.start && p.endDate <= opts.end).map((p) => [p.id, p])
  );

  const groups = new Map<
    string,
    { agentId: string; agentName: string; periodId: string; published: number[]; publishedDates: Set<string>; submitted: number; submittedDates: Set<string> }
  >();
  for (const a of audits) {
    if (!periodById.has(a.periodId)) continue;
    const key = `${a.agentId}|${a.periodId}`;
    const g = groups.get(key) ?? {
      agentId: a.agentId,
      agentName: a.agentName,
      periodId: a.periodId,
      published: [],
      publishedDates: new Set<string>(),
      submitted: 0,
      submittedDates: new Set<string>(),
    };
    if (a.status === "published") {
      if (a.percentage !== null) {
        g.published.push(a.percentage);
        g.publishedDates.add(a.auditDate);
      }
    } else {
      g.submitted += 1;
      g.submittedDates.add(a.auditDate);
    }
    groups.set(key, g);
  }

  const rawByPeriod = new Map<string, Awaited<ReturnType<typeof repo.getRawMetrics>>>();
  async function storedPct(agentId: string, periodId: string): Promise<number | null> {
    let rows = rawByPeriod.get(periodId);
    if (!rows) {
      rows = await repo.getRawMetrics(periodId);
      rawByPeriod.set(periodId, rows);
    }
    return rows.find((r) => r.agentId === agentId)?.qaAuditPct ?? null;
  }

  const issues: QaScoreIssue[] = [];
  for (const g of groups.values()) {
    const date = periodById.get(g.periodId)!.startDate;
    if (g.published.length > 0) {
      const expected = blend(g.published);
      const stored = await storedPct(g.agentId, g.periodId);
      if (stored === null || Math.abs(stored - expected) > 0.05) {
        issues.push({
          kind: "not_calculated",
          agentId: g.agentId,
          agentName: g.agentName,
          periodId: g.periodId,
          date,
          auditDates: [...g.publishedDates].sort(),
          auditCount: g.published.length,
          expectedPct: expected,
          currentPct: stored,
        });
      }
    }
    if (g.submitted > 0) {
      issues.push({
        kind: "not_published",
        agentId: g.agentId,
        agentName: g.agentName,
        periodId: g.periodId,
        date,
        auditDates: [...g.submittedDates].sort(),
        auditCount: g.submitted,
        expectedPct: null,
        currentPct: null,
      });
    }
  }

  return issues.sort((a, b) => (a.kind === b.kind ? a.agentName.localeCompare(b.agentName) || a.date.localeCompare(b.date) : a.kind === "not_calculated" ? -1 : 1));
}
