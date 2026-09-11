import { ALL_PENALTIES } from "./thresholds";
import type { PenaltyEntry } from "./types";

export interface AppliedPenalty {
  code: PenaltyEntry["code"];
  label: string;
  category: "disciplinary" | "attendance";
  deduction: number;
  count: number;
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
        code: p.code,
        label: def?.label ?? p.code,
        category: def?.category ?? "disciplinary",
        deduction: (def?.deduction ?? 0) * p.count,
        count: p.count,
      };
    });
}

export function totalPenaltyDeduction(applied: AppliedPenalty[]): number {
  return applied.reduce((sum, p) => sum + p.deduction, 0);
}
