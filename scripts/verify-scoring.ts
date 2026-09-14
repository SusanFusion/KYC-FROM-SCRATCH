/* eslint-disable no-console */
// Standalone verification runner — exercises the scoring engine directly
// against the seeded PDF data with zero framework dependencies, so it can
// run anywhere `tsx` runs (no Next.js/React/Tailwind install required).
// This is a supplement to the vitest suite in src/lib/scoring/__tests__,
// not a replacement for it.
import assert from "node:assert/strict";
import { SEED_AGENTS } from "../src/lib/data/seed/agents";
import { buildSeedRawMetrics, buildSeedGateMetrics } from "../src/lib/data/seed/rawMetrics";
import { calculateFullAgentResult } from "../src/lib/scoring/index";
import type { PenaltyEntry } from "../src/lib/scoring/types";

const rawMetrics = buildSeedRawMetrics();
const gate = buildSeedGateMetrics();
const penalties: PenaltyEntry[] = [];

console.log(`\nLoaded ${SEED_AGENTS.length} agents, ${rawMetrics.length} raw metric rows.\n`);
assert.equal(SEED_AGENTS.length, 17, "expected 17 seeded agents");
assert.equal(rawMetrics.length, 17, "expected 17 raw metric rows");

const results = rawMetrics.map((raw) => {
  const agent = SEED_AGENTS.find((a) => a.id === raw.agentId);
  assert.ok(agent, `missing agent for raw row ${raw.agentId}`);
  const result = calculateFullAgentResult({
    rawMetrics: raw,
    rawGate: gate,
    penalties,
    isTopPerformer: false,
    tenureEligible: agent.tenureEligible,
  });
  return { agent, ...result };
});

// Rank by final individual score, then mark #1 as top performer and
// recompute their bonus (mirrors what the app does for Rankings/Bonus).
const ranked = [...results].sort((a, b) => b.individual.finalScore - a.individual.finalScore);
console.log("Rank  Agent                     Score   Bracket        Gate      Bonus (PHP)");
console.log("----  ------------------------  ------  -------------  --------  -----------");
ranked.forEach((r, i) => {
  const isTop = i === 0;
  const bonus = isTop
    ? calculateFullAgentResult({
        rawMetrics: rawMetrics.find((m) => m.agentId === r.agent!.id)!,
        rawGate: gate,
        penalties,
        isTopPerformer: true,
        tenureEligible: r.agent!.tenureEligible,
      }).bonus
    : r.bonus;
  const flag = r.individual.hasIncompleteData ? " *" : "  ";
  console.log(
    `${String(i + 1).padEnd(4)}  ${r.agent!.name.padEnd(24)}  ${r.individual.finalScore
      .toFixed(2)
      .padStart(6)}${flag}  ${bonus.bracket.label.padEnd(13)}  ${bonus.gateMultiplier
      .toFixed(4)
      .padStart(8)}  ${bonus.totalBonusPhp.toFixed(2).padStart(11)}`
  );
});
console.log("\n(* = incomplete data for that agent this period)\n");

console.log("Business Gate breakdown for the current period:");
gate.periodId; // period id used above
const gateResult = results[0]!.gate;
gateResult.metrics.forEach((m) => {
  console.log(
    `  ${m.name.padEnd(55)} actual=${m.actualDisplay.padEnd(12)} tier=${(m.tier ?? "n/a").padEnd(
      12
    )} weighted=${m.weightedContribution ?? "excluded"}`
  );
});
console.log(`  Gate multiplier: ${gateResult.gateMultiplier} (${gateResult.overallTier})\n`);

// ── Sanity assertions (boundary + directionality checks) ──────────────────
import { calculateIndividualScore } from "../src/lib/scoring/individualScore";
import { calculateBusinessGate } from "../src/lib/scoring/businessGate";
import { determineBonusBracket } from "../src/lib/scoring/bonus";

function baseRaw(overrides: Partial<(typeof rawMetrics)[number]>) {
  return {
    agentId: "test-agent",
    periodId: "test-period",
    totalChatConversations: 10,
    avgFirstResponseTimeSec: 10,
    avgResponseTimeSec: 19,
    emailAHTSec: 15 * 60,
    appAHTSec: 20 * 60,
    totalChats: 10,
    csatCount: 10,
    dsatCount: 0,
    qaAuditPct: 96,
    ...overrides,
  };
}

// Perfect score → 3.00 exactly.
const perfect = calculateIndividualScore(baseRaw({}), []);
assert.equal(perfect.finalScore, 3, "perfect metrics should score exactly 3.00");

// Boundary: exactly 19s chat avg response → still grade 3 (≤19 sec is Exceptional).
const boundary1 = calculateIndividualScore(baseRaw({ avgResponseTimeSec: 19 }), []);
assert.equal(boundary1.metrics.find((m) => m.key === "chatAvgResponse")!.grade, 3);
// Just above → grade 2.
const boundary2 = calculateIndividualScore(baseRaw({ avgResponseTimeSec: 19.1 }), []);
assert.equal(boundary2.metrics.find((m) => m.key === "chatAvgResponse")!.grade, 2);
// 25 sec is the top of the "On Target" band (>19-25), per explicit instruction to use
// the Proposed Individual Grading Scales tables, NOT the framework's inconsistent
// worked example (which scored 25s as grade 3). See notes.ts "worked-example-mismatch".
const at25 = calculateIndividualScore(baseRaw({ avgResponseTimeSec: 25 }), []);
assert.equal(at25.metrics.find((m) => m.key === "chatAvgResponse")!.grade, 2);
const above25 = calculateIndividualScore(baseRaw({ avgResponseTimeSec: 25.1 }), []);
assert.equal(above25.metrics.find((m) => m.key === "chatAvgResponse")!.grade, 1);

// CSAT 92% (= 100 - (DSAT/Total Chats)*100 = 100 - 8/100*100) → grade 2 (90-94%),
// matching the table, not the example's grade-3.
const csat92 = calculateIndividualScore(baseRaw({ totalChats: 100, dsatCount: 8 }), []);
assert.equal(csat92.metrics.find((m) => m.key === "csatDsat")!.grade, 2);

// Missing QA metric → excluded + renormalized, not scored as 0.
const missingQa = calculateIndividualScore(baseRaw({ qaAuditPct: null }), []);
const qaMetric = missingQa.metrics.find((m) => m.key === "qaAudit")!;
assert.equal(qaMetric.excluded, true);
assert.equal(missingQa.hasIncompleteData, true);
assert.equal(missingQa.baseScore, 3, "excluding a perfect metric and renormalizing should still be 3.00");

// Penalty deduction applies pre-gate, floored at 0.
const heavyPenalty = calculateIndividualScore(baseRaw({}), [
  { id: "p1", agentId: "test-agent", periodId: "test-period", code: "unexcused_absence", count: 10, occurredOn: "2026-09-01" },
]);
assert.equal(heavyPenalty.finalScore, 0, "10x unexcused-absence penalties should floor score at 0, not go negative");

// Business Gate: all-Exceptional → 1.15 multiplier.
const allExceptional = calculateBusinessGate({
  periodId: "t",
  clientAvgWaitTimeMin: 30,
  teamProcessingTimeMin: 20,
  chatTeamAvgResponseSec: 20,
  teamTicketAHTMin: 20,
});
assert.equal(allExceptional.gateMultiplier, 1.15);

// Business Gate: all-Red → 0.5 multiplier.
const allRed = calculateBusinessGate({
  periodId: "t",
  clientAvgWaitTimeMin: 200,
  teamProcessingTimeMin: 200,
  chatTeamAvgResponseSec: 60,
  teamTicketAHTMin: 150,
});
assert.equal(allRed.gateMultiplier, 0.5);

// Framework's June worked example for the Gate multiplier (this part of the
// example IS internally consistent, unlike the individual-score example):
// Client Wait=Exceptional(1.15), Processing=Exceptional(1.15), Chat=Exceptional(1.15), Ticket AHT=Red(0.5)
// → 0.4025 + 0.3450 + 0.23 + 0.075 = 1.0525
const juneExample = calculateBusinessGate({
  periodId: "june",
  clientAvgWaitTimeMin: 50.39,
  teamProcessingTimeMin: 23.71,
  chatTeamAvgResponseSec: 16.5,
  teamTicketAHTMin: 4 * 60 + 56, // Red regardless of the PDF's two conflicting figures (4h56m vs 18h4m)
});
assert.equal(juneExample.gateMultiplier, 1.0525, `expected 1.0525, got ${juneExample.gateMultiplier}`);

// Bonus bracket boundaries.
assert.equal(determineBonusBracket(3).phpAmount, 27001);
assert.equal(determineBonusBracket(2.99).phpAmount, 21601);
assert.equal(determineBonusBracket(2.8).phpAmount, 21601);
assert.equal(determineBonusBracket(2.79).phpAmount, 16201);
assert.equal(determineBonusBracket(2.2).phpAmount, 5400);
assert.equal(determineBonusBracket(2.19).phpAmount, 0);
assert.equal(determineBonusBracket(0).phpAmount, 0);

console.log("✅ All scoring-engine sanity checks passed.\n");
