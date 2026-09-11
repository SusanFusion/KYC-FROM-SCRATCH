import { describe, it, expect } from "vitest";
import { determineBonusBracket, calculateBonus } from "../bonus";

describe("determineBonusBracket", () => {
  it.each([
    [3, 27001, 0.05],
    [2.99, 21601, 0.04],
    [2.8, 21601, 0.04],
    [2.79, 16201, 0.03],
    [2.6, 16201, 0.03],
    [2.59, 10800, 0.02],
    [2.4, 10800, 0.02],
    [2.39, 5400, 0.01],
    [2.2, 5400, 0.01],
    [2.19, 0, 0],
    [0, 0, 0],
  ])("score %s → ₱%s bonus (%s%%)", (score, php, pct) => {
    const bracket = determineBonusBracket(score as number);
    expect(bracket.phpAmount).toBe(php);
    expect(bracket.percentage).toBe(pct);
  });
});

describe("calculateBonus", () => {
  it("applies the Business Gate multiplier to the bracket amount", () => {
    const result = calculateBonus({
      agentId: "a1",
      periodId: "p1",
      finalScore: 2.65,
      gateMultiplier: 1.0525,
      isTopPerformer: false,
      tenureEligible: true,
    });
    expect(result.baseBonusPhp).toBe(16201);
    expect(result.bonusAfterGate).toBe(17051.55);
    expect(result.totalBonusPhp).toBe(17051.55);
  });

  it("adds the flat ₱1,350 Top-1 bonus AFTER the gate multiplier", () => {
    const result = calculateBonus({
      agentId: "a1",
      periodId: "p1",
      finalScore: 2.65,
      gateMultiplier: 1.0525,
      isTopPerformer: true,
      tenureEligible: true,
    });
    expect(result.totalBonusPhp).toBe(18401.55);
  });

  it("pays nothing when the agent is not tenure-eligible, regardless of score", () => {
    const result = calculateBonus({
      agentId: "a1",
      periodId: "p1",
      finalScore: 3,
      gateMultiplier: 1.15,
      isTopPerformer: true,
      tenureEligible: false,
    });
    expect(result.totalBonusPhp).toBe(0);
  });

  it("pays nothing below the lowest bracket even with a perfect gate", () => {
    const result = calculateBonus({
      agentId: "a1",
      periodId: "p1",
      finalScore: 2.0,
      gateMultiplier: 1.15,
      isTopPerformer: false,
      tenureEligible: true,
    });
    expect(result.totalBonusPhp).toBe(0);
  });
});
