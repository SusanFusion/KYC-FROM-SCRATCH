import { ALL_PENALTIES } from "./thresholds";
import type { PenaltyEntry, PenaltyCategory, PenaltyStatus, PenaltyMonthlyGrace } from "./types";

export interface AppliedPenalty {
  id: string;
  code: PenaltyEntry["code"];
  label: string;
  category: PenaltyCategory;
  deduction: number;
  count: number;
  /** ISO date the infraction actually occurred on (as entered on the
   *  "Record a penalty" form) -- distinct from when it was logged. */
  occurredOn: string;
  /** Who recorded this entry -- see PenaltyEntry.recordedBy. */
  recordedBy: string;
  /** Present only for employment track-record actions (deduction is always
   *  0 for these) -- see EMPLOYMENT_ACTIONS in thresholds.ts. */
  status?: PenaltyStatus;
}

/** Sorts one agent's entries for a single code chronologically (by
 *  occurredOn, then by id as a stable tiebreak for two entries on the same
 *  day) -- see monthlyGraceShare. Exact same-day ordering never changes the
 *  MONTH's total deduction (that's always a plain floor(totalCount / every),
 *  order-independent); it only decides which specific entry visually
 *  "carries" the deduction when two land on the same date. */
function chronological(entries: PenaltyEntry[]): PenaltyEntry[] {
  return [...entries].sort((a, b) => {
    if (a.occurredOn !== b.occurredOn) return a.occurredOn < b.occurredOn ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * For a monthlyGrace-metered code (see PenaltyMonthlyGrace -- e.g. "Late
 * Onsite (less than 15 minutes)": free for the first 3 times a calendar
 * month, the 4th time deducts -0.05, 5th-7th free again, 8th deducts, and so
 * on), works out ONE entry's own share of that month's deduction.
 *
 * `sameCodeThisAgent` must be this agent's FULL history for this one code —
 * not just what's in view for the period/range currently being rendered —
 * otherwise an agent's real 4th time this month could read as their "1st"
 * simply because the page happens to only show a single day or one week.
 * See resolveEntry below for where that full history comes from, and count
 * as the running total -- a single entry recorded with count > 1 (several
 * occurrences logged at once) is handled correctly too, since a telescoping
 * floor-division still lands the deduction on whichever occurrence
 * position(s) inside that entry cross a multiple of `every`.
 */
function monthlyGraceShare(entry: PenaltyEntry, sameCodeThisAgent: PenaltyEntry[], grace: PenaltyMonthlyGrace): number {
  const month = entry.occurredOn.slice(0, 7); // YYYY-MM
  const monthEntries = chronological(sameCodeThisAgent.filter((e) => e.occurredOn.slice(0, 7) === month));

  let cumulative = 0;
  for (const e of monthEntries) {
    const before = cumulative;
    cumulative += e.count;
    if (e.id === entry.id) {
      const triggers = Math.floor(cumulative / grace.every) - Math.floor(before / grace.every);
      return triggers * grace.deduction;
    }
  }
  return 0; // unreachable -- entry is always a member of sameCodeThisAgent
}

/** Resolves one penalty entry against the Disciplinary + Attendance Penalty
 *  tables and works out its deduction (per-occurrence deduction × count, or
 *  the monthly-grace share for a metered code like Late Onsite <15min -- see
 *  monthlyGraceShare). Shared by calculatePenalty (period/range-scoped) and
 *  calculateAllPenalties (every entry, no period scoping) below -- both need
 *  the exact same per-entry math, just over a different slice of entries. */
function resolveEntry(p: PenaltyEntry, sameCodeThisAgent: PenaltyEntry[]): AppliedPenalty {
  const def = ALL_PENALTIES.find((d) => d.code === p.code);
  const deduction = def?.monthlyGrace
    ? monthlyGraceShare(p, sameCodeThisAgent, def.monthlyGrace)
    : (def?.deduction ?? 0) * p.count;
  return {
    id: p.id,
    code: p.code,
    label: def?.label ?? p.code,
    category: def?.category ?? "disciplinary",
    deduction,
    count: p.count,
    occurredOn: p.occurredOn,
    recordedBy: p.recordedBy,
    status: def?.status,
  };
}

/**
 * Resolves the penalty entries recorded for one agent/period against the
 * Disciplinary + Attendance Penalty tables and returns each with its total
 * deduction. No cap is applied — see notes.ts "penalty-floor".
 *
 * `penalties` must be the agent's FULL penalty history, not just this
 * period/range's -- entries outside `periodId` are filtered out of the
 * RETURNED list same as before, but are still needed internally so a
 * monthly-grace code can see the whole calendar month regardless of which
 * single day or range is actually being viewed (see loadPeriodDataset and
 * loadRangeDataset in query.ts, which both now pass the full list through
 * for exactly this reason).
 */
export function calculatePenalty(
  agentId: string,
  periodId: string,
  penalties: PenaltyEntry[]
): AppliedPenalty[] {
  const agentPenalties = penalties.filter((p) => p.agentId === agentId);

  return agentPenalties
    .filter((p) => p.periodId === periodId)
    .map((p) => resolveEntry(p, agentPenalties.filter((e) => e.code === p.code)));
}

/**
 * Every penalty entry ever recorded for one agent, regardless of which
 * period it's tagged with -- used by the Penalties admin page's "Recorded
 * this period" log (see penalties/page.tsx), which is meant to be a durable
 * running record of everything anyone has logged, not scoped to whichever
 * daily import happens to be "current" today. (calculatePenalty above IS
 * meant to be period/range-scoped -- that's what actually feeds an agent's
 * score on Scorecards/Rankings/Team Performance -- so it stays as-is.)
 * Deductions, including monthlyGrace shares, are computed exactly the same
 * way as calculatePenalty.
 */
export function calculateAllPenalties(agentId: string, penalties: PenaltyEntry[]): AppliedPenalty[] {
  const agentPenalties = penalties.filter((p) => p.agentId === agentId);
  return agentPenalties.map((p) => resolveEntry(p, agentPenalties.filter((e) => e.code === p.code)));
}

export function totalPenaltyDeduction(applied: AppliedPenalty[]): number {
  return applied.reduce((sum, p) => sum + p.deduction, 0);
}
