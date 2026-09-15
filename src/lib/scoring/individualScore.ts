import { INDIVIDUAL_METRICS, INDIVIDUAL_MAX_SCORE } from "./thresholds";
import { gradeIndividualMetric } from "./grade";
import { computeBuffer } from "./display";
import { calculatePenalty, totalPenaltyDeduction } from "./penalties";
import { formatSeconds, formatMinutes } from "../data/time";
import type {
  IndividualMetricKey,
  IndividualScoreResult,
  MetricScoreBreakdown,
  PenaltyEntry,
  RawAgentMetrics,
} from "./types";

/**
 * Derives CSAT % as the complement of the DSAT rate over ALL chats:
 * CSAT % = 100 − (DSAT ÷ Total Chats) × 100. See notes.ts
 * ("csat-percentage-derivation"). The CSAT Count field is still collected
 * (kept on the raw record and shown in the import review) but is not part
 * of this calculation.
 */
export function deriveCsatPercent(totalChats: number | null, dsatCount: number | null): number | null {
  if (totalChats === null || dsatCount === null) return null;
  if (totalChats === 0) return null;
  return 100 - (dsatCount / totalChats) * 100;
}

function getMetricValue(raw: RawAgentMetrics, key: IndividualMetricKey): number | null {
  switch (key) {
    case "appAHT":
      return raw.appAHTSec !== null ? raw.appAHTSec / 60 : null;
    case "emailAHT":
      return raw.emailAHTSec !== null ? raw.emailAHTSec / 60 : null;
    case "chatAvgResponse":
      return raw.avgResponseTimeSec;
    case "chatFRT":
      return raw.avgFirstResponseTimeSec;
    case "csatDsat":
      return deriveCsatPercent(raw.totalChats, raw.dsatCount);
    case "qaAudit":
      return raw.qaAuditPct;
  }
}

export function formatActual(key: IndividualMetricKey, value: number | null): string {
  if (value === null) return "No data";
  switch (key) {
    case "appAHT":
    case "emailAHT":
      return formatMinutes(value * 60);
    case "chatAvgResponse":
    case "chatFRT":
      return formatSeconds(value);
    case "csatDsat":
    case "qaAudit":
      return `${value.toFixed(1)}%`;
  }
}

/**
 * Calculates one agent's Layer 2 individual scorecard for one period,
 * including penalty deductions. Missing metrics are excluded from the
 * weighted sum and the remaining weights are renormalized to a 0-3 scale
 * (see notes.ts "missing-qa-audit-data") rather than silently scored as 0,
 * which would otherwise understate an agent's score for data the team
 * simply hasn't collected yet.
 */
export function calculateIndividualScore(
  raw: RawAgentMetrics,
  penalties: PenaltyEntry[]
): IndividualScoreResult {
  const metrics: MetricScoreBreakdown[] = INDIVIDUAL_METRICS.map((def) => {
    const value = getMetricValue(raw, def.key);
    if (value === null) {
      return {
        key: def.key,
        name: def.name,
        actual: null,
        actualDisplay: "No data",
        target: def.target,
        weight: def.weight,
        grade: null,
        gradeLabel: "No Data",
        weightedPoints: null,
        excluded: true,
        bufferLabel: null,
        bufferGood: null,
      };
    }
    const band = gradeIndividualMetric(value, def.bands, def.direction);
    const grade = band ? band.grade : 0;
    const safeBand = def.bands.find((b) => b.label === "On Target");
    const buffer = computeBuffer(value, safeBand, def.unit, def.direction);
    return {
      key: def.key,
      name: def.name,
      actual: value,
      actualDisplay: formatActual(def.key, value),
      target: def.target,
      weight: def.weight,
      grade,
      gradeLabel: band ? band.label : "Failing",
      weightedPoints: grade * def.weight,
      excluded: false,
      bufferLabel: buffer?.label ?? null,
      bufferGood: buffer?.good ?? null,
    };
  });

  const available = metrics.filter((m) => !m.excluded);
  const weightedSubtotal = available.reduce((sum, m) => sum + (m.weightedPoints ?? 0), 0);
  const effectiveWeight = available.reduce((sum, m) => sum + m.weight, 0);
  const hasIncompleteData = available.length !== metrics.length;

  // Renormalize to the full 0-3 scale when some metrics are missing, so a
  // partially-measured agent isn't penalized for data gaps that aren't
  // their fault (see notes.ts "missing-qa-audit-data"). Note: weightedSubtotal
  // is already on a 0-3 scale when all weights are present (grade[0-3] *
  // weight, weights summing to 1) — dividing by effectiveWeight (the sum of
  // the weights actually available) simply rescales a partial subtotal back
  // up to what it would be at full weight=1. It must NOT also be multiplied
  // by INDIVIDUAL_MAX_SCORE — that would double-scale it.
  const baseScore = effectiveWeight > 0 ? weightedSubtotal / effectiveWeight : 0;

  const penaltiesApplied = calculatePenalty(raw.agentId, raw.periodId, penalties);
  const penaltyTotal = totalPenaltyDeduction(penaltiesApplied);

  // Floored at 0 — see notes.ts "penalty-floor".
  const finalScore = Math.max(0, round2(baseScore - penaltyTotal));

  return {
    agentId: raw.agentId,
    periodId: raw.periodId,
    metrics,
    hasIncompleteData,
    weightedSubtotal: round2(weightedSubtotal),
    effectiveWeight,
    baseScore: round2(baseScore),
    maxScore: INDIVIDUAL_MAX_SCORE,
    penaltyTotal: round2(penaltyTotal),
    penaltiesApplied,
    finalScore,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
