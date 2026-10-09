import type { GateTier } from "@/lib/scoring/types";

// Pure helpers for the Quarter page, which builds a quarter out of its three
// calendar months: every agent's overall grade for each month, and the
// Business Gate multiplier for each month plus their average.

/** The three "YYYY-MM" keys of the quarter that starts on `quarterStart`. */
export function quarterMonthKeys(quarterStart: string): string[] {
  const year = Number(quarterStart.slice(0, 4));
  const firstMonth = Number(quarterStart.slice(5, 7));
  return [0, 1, 2].map((i) => `${year}-${String(firstMonth + i).padStart(2, "0")}`);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Same cut-offs the Business Gate itself uses for a month's overall tier
 *  (see tierFromMultiplier in businessGate.ts) -- applied here to the
 *  average multiplier. */
export function tierFromMultiplier(multiplier: number): GateTier {
  if (multiplier >= 1.15) return "Exceptional";
  if (multiplier >= 1.0) return "Green";
  if (multiplier >= 0.7) return "Amber";
  return "Red";
}

/** How an agent's month should be treated:
 *  - "scored": enough real data -- shown and counted in the quarter average.
 *  - "limited": some data, but under the minimum coverage -- shown, flagged,
 *    and NOT counted (a thin sample can renormalize to a flattering score).
 *  - "none": nothing imported for this agent that month -- shown as a dash. */
export type MonthState = "scored" | "limited" | "none";

export interface AgentMonthGrade {
  /** The agent's final overall grade (0-3, after that month's penalties), or null when there is none. */
  grade: number | null;
  state: MonthState;
}

/**
 * The quarter score: the average of the agent's monthly overall grades (only
 * months that count), minus the automatic Repeated Offenses deduction, never
 * below zero. Null when no month counts yet.
 */
export function quarterScoreFromMonths(months: AgentMonthGrade[], repeatedOffenseDeduction: number): number | null {
  const counted = months.filter((m) => m.state === "scored" && m.grade !== null).map((m) => m.grade as number);
  const avg = mean(counted);
  if (avg === null) return null;
  return Math.max(0, round2(avg - repeatedOffenseDeduction));
}
