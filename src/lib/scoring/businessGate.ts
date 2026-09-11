import { GATE_METRICS, GATE_TIER_SCORES, GATE_MULTIPLIER_MIN, GATE_MULTIPLIER_MAX } from "./thresholds";
import { gradeGateMetric } from "./grade";
import { formatMinutes, formatSeconds } from "../data/time";
import type { BusinessGateResult, GateMetricBreakdown, GateTier, RawGateMetrics } from "./types";

function tierScore(tier: GateTier): number {
  return GATE_TIER_SCORES.find((t) => t.tier === tier)?.score ?? 0.5;
}

function getGateValue(raw: RawGateMetrics, key: GateMetricBreakdown["key"]): number | null {
  switch (key) {
    case "clientAvgWaitTime":
      return raw.clientAvgWaitTimeMin;
    case "teamProcessingTime":
      return raw.teamProcessingTimeMin;
    case "chatTeamAvgResponse":
      return raw.chatTeamAvgResponseSec;
    case "teamTicketAHT":
      return raw.teamTicketAHTMin;
  }
}

function formatGateValue(unit: "minutes" | "seconds", value: number | null): string {
  if (value === null) return "No data";
  return unit === "minutes" ? formatMinutes(value * 60) : formatSeconds(value);
}

/**
 * Calculates the Layer 1 Business Gate multiplier for one period: a
 * weighted average of each team-level metric's tier score, clamped to the
 * documented [0.50, 1.15] range as a sanity check (the weighted average of
 * the tier scores can never actually exceed that range given the defined
 * weights, but the clamp guards against a future change to the weights).
 */
export function calculateBusinessGate(raw: RawGateMetrics): BusinessGateResult {
  const metrics: GateMetricBreakdown[] = GATE_METRICS.map((def) => {
    const value = getGateValue(raw, def.key);
    if (value === null) {
      return {
        key: def.key,
        name: def.name,
        actual: null,
        actualDisplay: "No data",
        weight: def.weight,
        tier: null,
        tierScore: null,
        weightedContribution: null,
      };
    }
    const band = gradeGateMetric(value, def.bands, def.direction);
    const tier = band?.tier ?? "Red";
    const score = tierScore(tier);
    // Keep full precision here (only rounded to 4dp for display, matching the
    // framework's own worked example, e.g. 0.4025 / 0.3450 / 0.23 / 0.075) —
    // rounding each term to 2dp before summing was found (via
    // scripts/verify-scoring.ts) to shift the final multiplier by ~0.01.
    const weightedContribution = round4(score * def.weight);
    return {
      key: def.key,
      name: def.name,
      actual: value,
      actualDisplay: formatGateValue(def.unit, value),
      weight: def.weight,
      tier,
      tierScore: score,
      weightedContribution,
    };
  });

  const available = metrics.filter((m) => m.weightedContribution !== null);
  const effectiveWeight = available.reduce((sum, m) => sum + m.weight, 0);
  const weightedSum = available.reduce((sum, m) => sum + (m.weightedContribution ?? 0), 0);

  const rawMultiplier = effectiveWeight > 0 ? weightedSum / effectiveWeight : 1;
  const gateMultiplier = round4(
    Math.min(GATE_MULTIPLIER_MAX, Math.max(GATE_MULTIPLIER_MIN, rawMultiplier))
  );

  const overallTier = tierFromMultiplier(gateMultiplier);

  return { periodId: raw.periodId, metrics, gateMultiplier, overallTier };
}

function tierFromMultiplier(multiplier: number): GateTier {
  if (multiplier >= 1.15) return "Exceptional";
  if (multiplier >= 1.0) return "Green";
  if (multiplier >= 0.7) return "Amber";
  return "Red";
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
