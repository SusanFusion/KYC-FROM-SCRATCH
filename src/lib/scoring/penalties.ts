import { ALL_PENALTIES } from "./thresholds";
import type { PenaltyEntry, PenaltyCategory, PenaltyStatus } from "./types";

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

/**
 * Resolves the penalty entries recorded for one agent/period against the
 * Disciplinary + Attendance Penalty tables and returns each with its total
 * deduction (per-occurrence deduction × count). No cap is applied — see
 * notes.ts "penalty-floor".
 */
export function calculatePenalty(
  agentId: string,
  periodId: string,
  penalties: PenaltyEntry[]
): AppliedPenalty[] {
  return penalties
    .filter((p) => p.agentId === agentId && p.periodId === periodId)
    .map((p) => {
      const def = ALL_PENALTIES.find((d) => d.code === p.code);
      return {
        id: p.id,
        code: p.code,
        label: def?.label ?? p.code,
        category: def?.category ?? "disciplinary",
        deduction: (def?.deduction ?? 0) * p.count,
        count: p.count,
        occurredOn: p.occurredOn,
        recordedBy: p.recordedBy,
        status: def?.status,
      };
    });
}

export function totalPenaltyDeduction(applied: AppliedPenalty[]): number {
  return applied.reduce((sum, p) => sum + p.deduction, 0);
}
