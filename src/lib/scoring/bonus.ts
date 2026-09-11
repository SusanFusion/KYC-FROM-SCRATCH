import { BONUS_BRACKETS, TOP_PERFORMER_BONUS_PHP } from "./thresholds";
import { round2 } from "./individualScore";
import type { AgentBonusResult, BonusBracket } from "./types";

/** Finds the bonus bracket a final score falls into. Score 3.00 is the top bracket. */
export function determineBonusBracket(finalScore: number): BonusBracket {
  for (const bracket of BONUS_BRACKETS) {
    const atOrAboveMin = finalScore >= bracket.scoreMin;
    const belowMax = bracket.scoreMax === null || finalScore < bracket.scoreMax;
    if (atOrAboveMin && belowMax) return bracket;
  }
  return BONUS_BRACKETS[BONUS_BRACKETS.length - 1]!;
}

export interface CalculateBonusInput {
  agentId: string;
  periodId: string;
  finalScore: number;
  gateMultiplier: number;
  isTopPerformer: boolean;
  tenureEligible: boolean;
}

/**
 * Full end-to-end bonus calculation:
 *   base bonus (from bracket) × Business Gate multiplier, plus a flat
 *   ₱1,350 Top-1 bonus applied AFTER the gate multiplier (matches the
 *   framework's worked example: 16,201 × 1.0525 = 17,051.55, then +1,350 =
 *   18,401.55).
 * If an agent isn't tenure-eligible, the bonus is still calculated (for
 * transparency) but flagged as not payable.
 */
export function calculateBonus(input: CalculateBonusInput): AgentBonusResult {
  const bracket = determineBonusBracket(input.finalScore);
  const baseBonusPhp = bracket.phpAmount;
  const bonusAfterGate = round2(baseBonusPhp * input.gateMultiplier);
  const topPerformerBonusPhp = input.isTopPerformer ? TOP_PERFORMER_BONUS_PHP : 0;
  const totalBonusPhp = input.tenureEligible
    ? round2(bonusAfterGate + topPerformerBonusPhp)
    : 0;

  return {
    agentId: input.agentId,
    periodId: input.periodId,
    finalScore: input.finalScore,
    bracket,
    baseBonusPhp,
    gateMultiplier: input.gateMultiplier,
    bonusAfterGate,
    isTopPerformer: input.isTopPerformer,
    topPerformerBonusPhp,
    totalBonusPhp,
    tenureEligible: input.tenureEligible,
  };
}
