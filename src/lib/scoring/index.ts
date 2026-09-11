export * from "./types";
export * from "./thresholds";
export * from "./grade";
export * from "./individualScore";
export * from "./businessGate";
export * from "./bonus";
export * from "./penalties";
export { DATA_NOTES } from "./notes";
export type { DataNote } from "./notes";

import { calculateIndividualScore } from "./individualScore";
import { calculateBusinessGate } from "./businessGate";
import { calculateBonus } from "./bonus";
import type { PenaltyEntry, RawAgentMetrics, RawGateMetrics } from "./types";

export interface FullAgentPeriodResult {
  individual: ReturnType<typeof calculateIndividualScore>;
  gate: ReturnType<typeof calculateBusinessGate>;
  bonus: ReturnType<typeof calculateBonus>;
}

/**
 * Orchestrates the full three-step calculation for one agent in one period:
 * Layer 2 individual score → Layer 1 gate multiplier → final bonus.
 * This is the single entry point UI code should call rather than composing
 * the pieces itself, so the pipeline stays centralized and testable.
 */
export function calculateFullAgentResult(params: {
  rawMetrics: RawAgentMetrics;
  rawGate: RawGateMetrics;
  penalties: PenaltyEntry[];
  isTopPerformer: boolean;
  tenureEligible: boolean;
}): FullAgentPeriodResult {
  const individual = calculateIndividualScore(params.rawMetrics, params.penalties);
  const gate = calculateBusinessGate(params.rawGate);
  const bonus = calculateBonus({
    agentId: params.rawMetrics.agentId,
    periodId: params.rawMetrics.periodId,
    finalScore: individual.finalScore,
    gateMultiplier: gate.gateMultiplier,
    isTopPerformer: params.isTopPerformer,
    tenureEligible: params.tenureEligible,
  });
  return { individual, gate, bonus };
}
