// Team Quality Rating: the average score of every QA audit recorded in the
// app, as a percentage.
//
// It is shown on Team Performance and the Dashboard for visibility only. It is
// not one of the four Business Gate metrics and it never changes the Gate
// multiplier or any agent's score -- it just gives the team one overall
// quality number next to the Gate.
//
// Every recorded audit counts, whether or not it has been published yet, and
// whichever day or month it was filed under: this is the overall average of
// the audits in the app, so it reads the same on every page. Each audit counts
// equally (a plain average of the audit percentages). An audit with no
// percentage is left out because there is nothing to average.
//
// Only the team-wide number leaves this function. No individual audit or agent
// is exposed, so it is safe to show to everyone.

import { getRepository } from "@/lib/data/repository";

export interface TeamQualityRating {
  /** Average of every recorded audit percentage, one decimal; null when there are none. */
  ratingPct: number | null;
  /** How many audits the average is built from. */
  auditCount: number;
}

export async function loadTeamQualityRating(): Promise<TeamQualityRating> {
  try {
    const repo = await getRepository();
    const audits = await repo.getQaAudits();

    const scores: number[] = [];
    for (const a of audits) {
      if (a.percentage !== null) scores.push(a.percentage);
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
