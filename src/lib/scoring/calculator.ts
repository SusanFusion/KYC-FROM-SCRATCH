// Pure math behind the Score Calculator page. It uses the SAME thresholds,
// weights, rounding and renormalisation as calculateIndividualScore (the real
// scorecard), but starts from the figures an agent types in rather than from an
// imported period, so what they see here is what the scorecard would show.
//
// The one deliberate difference: CSAT is typed in as a percentage. The real
// scorecard derives it from total chats and DSAT count (see deriveCsatPercent),
// which an agent doesn't have to hand when they're just trying out a number.

import { ATTENDANCE_PENALTIES, DISCIPLINARY_PENALTIES, INDIVIDUAL_MAX_SCORE, INDIVIDUAL_METRICS, SCORE_PASS_THRESHOLD } from "./thresholds";
import { gradeIndividualMetric } from "./grade";
import { round2 } from "./individualScore";
import type { Grade, IndividualMetricKey, PenaltyDefinition } from "./types";

export type CalculatorValues = Partial<Record<IndividualMetricKey, number | null>>;

export interface CalculatorRow {
  key: IndividualMetricKey;
  name: string;
  target: string;
  unit: "minutes" | "seconds" | "percent";
  weight: number;
  value: number | null;
  grade: Grade | null;
  gradeLabel: string;
  weightedPoints: number | null;
  excluded: boolean;
}

export interface CalculatorResult {
  rows: CalculatorRow[];
  /** Weighted score on the 0-3 scale, before penalties (missing KPIs left out and the rest scaled up). */
  baseScore: number;
  /** Share of the full weight that has a figure typed in (0-1). */
  effectiveWeight: number;
  hasMissing: boolean;
  penaltyTotal: number;
  /** After penalties, never below 0. */
  finalScore: number;
  maxScore: number;
  passes: boolean;
  passLine: number;
  /** True once at least one KPI has a figure. */
  hasAny: boolean;
}

export type ParsedKpiInput = { ok: true; value: number | null } | { ok: false; error: string };

/** Reads what the agent typed. Blank is fine (the KPI is left out). Minutes
 *  KPIs also accept "m:ss" (22:30 = 22.5 minutes). A trailing "%" is ignored. */
export function parseKpiInput(text: string, unit: "minutes" | "seconds" | "percent"): ParsedKpiInput {
  const raw = text.trim().replace(/%$/, "").trim();
  if (raw === "") return { ok: true, value: null };

  if (unit === "minutes") {
    const clock = /^(\d+):([0-5]?\d)$/.exec(raw);
    if (clock) return { ok: true, value: Number(clock[1]) + Number(clock[2]) / 60 };
  }

  if (!/^\d+(\.\d+)?$/.test(raw)) {
    return { ok: false, error: unit === "minutes" ? "Use a number like 22.5, or minutes:seconds like 22:30." : "Use a number like 22.5." };
  }
  const value = Number(raw);
  if (unit === "percent" && value > 100) return { ok: false, error: "A percentage can't be more than 100." };
  return { ok: true, value };
}

/** Penalties that actually take points off, in the order the Penalties page lists them. */
export const CALCULATOR_PENALTIES: PenaltyDefinition[] = [...DISCIPLINARY_PENALTIES, ...ATTENDANCE_PENALTIES].filter(
  (p) => p.deduction > 0 || p.monthlyGrace !== undefined
);

/** Points taken off for `count` of one penalty. A code with a monthly grace
 *  (Late Onsite under 15 minutes) is free until the 4th time, then every 4th
 *  one deducts, exactly like the Penalties page. */
export function penaltyDeduction(def: PenaltyDefinition, count: number): number {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (n === 0) return 0;
  if (def.monthlyGrace) return Math.floor(n / def.monthlyGrace.every) * def.monthlyGrace.deduction;
  return def.deduction * n;
}

export function calculateFromValues(values: CalculatorValues, penaltyCounts: Record<string, number> = {}): CalculatorResult {
  const rows: CalculatorRow[] = INDIVIDUAL_METRICS.map((def) => {
    const value = values[def.key] ?? null;
    if (value === null) {
      return {
        key: def.key,
        name: def.name,
        target: def.target,
        unit: def.unit,
        weight: def.weight,
        value: null,
        grade: null,
        gradeLabel: "No data",
        weightedPoints: null,
        excluded: true,
      };
    }
    // Same whole-second grading as the scorecard for Chat Avg Response.
    const gradingValue = def.key === "chatAvgResponse" ? Math.round(value) : value;
    const band = gradeIndividualMetric(gradingValue, def.bands, def.direction);
    const grade = (band ? band.grade : 0) as Grade;
    return {
      key: def.key,
      name: def.name,
      target: def.target,
      unit: def.unit,
      weight: def.weight,
      value,
      grade,
      gradeLabel: band ? band.label : "Failing",
      weightedPoints: grade * def.weight,
      excluded: false,
    };
  });

  const available = rows.filter((r) => !r.excluded);
  const weightedSubtotal = available.reduce((sum, r) => sum + (r.weightedPoints ?? 0), 0);
  const effectiveWeight = available.reduce((sum, r) => sum + r.weight, 0);
  const baseScore = effectiveWeight > 0 ? weightedSubtotal / effectiveWeight : 0;

  let penaltyTotal = 0;
  for (const def of CALCULATOR_PENALTIES) {
    penaltyTotal += penaltyDeduction(def, penaltyCounts[def.code] ?? 0);
  }

  const finalScore = available.length === 0 ? 0 : Math.max(0, round2(baseScore - penaltyTotal));

  return {
    rows,
    baseScore: round2(baseScore),
    effectiveWeight,
    hasMissing: available.length !== rows.length,
    penaltyTotal: round2(penaltyTotal),
    finalScore,
    maxScore: INDIVIDUAL_MAX_SCORE,
    passes: finalScore >= SCORE_PASS_THRESHOLD,
    passLine: SCORE_PASS_THRESHOLD,
    hasAny: available.length > 0,
  };
}
