// Team Quality Rating: the average score of the QA audits that have been
// PUBLISHED for the days in a window, as a percentage.
//
// It is shown on Team Performance and the Dashboard for visibility only. It is
// not one of the four Business Gate metrics and it never changes the Gate
// multiplier or any agent's score -- it just gives the team one overall
// quality number next to the Gate.
//
// Which audits count: the same ones that feed the scorecards. An audit counts
// toward the day it is filed against (its period), and only once it is
// published -- a submitted-but-unpublished audit is left out, exactly as it is
// from the QA Audit column on the scorecard. Every published audit counts
// equally (a plain average of audit percentages).
//
// Only the team-wide number leaves this function. No individual audit or agent
// is exposed, so it is safe to show to everyone.

import { getRepository } from "@/lib/data/repository";

export interface TeamQualityRating {
  /** Average of the published audit percentages, one decimal; null when there are none. */
  ratingPct: number | null;
  /** How many published audits the average is built from. */
  auditCount: number;
}

export async function loadTeamQualityRating(range: { start: string; end: string }): Promise<TeamQualityRating> {
  try {
    const repo = await getRepository();
    const [periods, audits] = await Promise.all([repo.getPeriods(), repo.getQaAudits()]);

    // Only single-day periods count (that is what scorecards aggregate), and
    // only those inside the window being viewed.
    const dayPeriodIds = new Set(
      periods.filter((p) => p.startDate === p.endDate && p.startDate >= range.start && p.endDate <= range.end).map((p) => p.id)
    );

    const scores: number[] = [];
    for (const a of audits) {
      if (a.status !== "published" || a.percentage === null) continue;
      if (!dayPeriodIds.has(a.periodId)) continue;
      scores.push(a.percentage);
    }

    if (scores.length === 0) return { ratingPct: null, auditCount: 0 };
    const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    return { ratingPct: Math.round(average * 10) / 10, auditCount: scores.length };
  } catch {
    // The rating is an extra. If the audits can't be read, the page still
    // loads and the card just shows "No data yet".
    return { ratingPct: null, auditCount: 0 };
  }
}
