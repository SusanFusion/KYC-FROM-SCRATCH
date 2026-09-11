import { describe, it, expect } from "vitest";
import { calculateBusinessGate } from "../businessGate";
import type { RawGateMetrics } from "../types";

function raw(overrides: Partial<RawGateMetrics> = {}): RawGateMetrics {
  return {
    periodId: "t",
    clientAvgWaitTimeMin: 30,
    teamProcessingTimeMin: 20,
    chatTeamAvgResponseSec: 20,
    teamTicketAHTMin: 20,
    ...overrides,
  };
}

describe("calculateBusinessGate", () => {
  it("gives a 1.15 multiplier when every metric is Exceptional", () => {
    expect(calculateBusinessGate(raw()).gateMultiplier).toBe(1.15);
  });

  it("gives a 1.00 multiplier when every metric is exactly on Green target", () => {
    const r = calculateBusinessGate(
      raw({
        clientAvgWaitTimeMin: 120,
        teamProcessingTimeMin: 90,
        chatTeamAvgResponseSec: 40,
        teamTicketAHTMin: 60,
      })
    );
    expect(r.gateMultiplier).toBe(1.0);
  });

  it("gives a 0.50 multiplier when every metric is Red", () => {
    const r = calculateBusinessGate(
      raw({
        clientAvgWaitTimeMin: 181,
        teamProcessingTimeMin: 181,
        chatTeamAvgResponseSec: 51,
        teamTicketAHTMin: 121,
      })
    );
    expect(r.gateMultiplier).toBe(0.5);
  });

  it("matches the framework's Gate-multiplier worked example (1.0525)", () => {
    // Client Wait, Processing Time, Chat Response all Exceptional; Ticket AHT Red.
    // 1.15*0.35 + 1.15*0.30 + 1.15*0.20 + 0.5*0.15 = 1.0525
    const r = calculateBusinessGate(
      raw({
        clientAvgWaitTimeMin: 50.39,
        teamProcessingTimeMin: 23.71,
        chatTeamAvgResponseSec: 16.5,
        teamTicketAHTMin: 296, // 4h56m, Red either way
      })
    );
    expect(r.gateMultiplier).toBe(1.0525);
  });

  it("renormalizes across available metrics when some are missing", () => {
    const r = calculateBusinessGate(
      raw({ clientAvgWaitTimeMin: null, teamProcessingTimeMin: null })
    );
    // Only chat (20%) + ticket AHT (15%) available, both Exceptional (1.15)
    expect(r.gateMultiplier).toBe(1.15);
    expect(r.metrics.find((m) => m.key === "clientAvgWaitTime")!.tier).toBeNull();
  });

  it("stays within the documented [0.50, 1.15] range", () => {
    const best = calculateBusinessGate(raw()).gateMultiplier;
    const worst = calculateBusinessGate(
      raw({
        clientAvgWaitTimeMin: 999,
        teamProcessingTimeMin: 999,
        chatTeamAvgResponseSec: 999,
        teamTicketAHTMin: 999,
      })
    ).gateMultiplier;
    expect(best).toBeLessThanOrEqual(1.15);
    expect(worst).toBeGreaterThanOrEqual(0.5);
  });
});
