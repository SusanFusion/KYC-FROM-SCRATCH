import { describe, it, expect } from "vitest";
import { calculateIndividualScore, deriveCsatPercent } from "../individualScore";
import type { RawAgentMetrics } from "../types";

function raw(overrides: Partial<RawAgentMetrics> = {}): RawAgentMetrics {
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

describe("calculateIndividualScore", () => {
  it("scores a perfect agent exactly 3.00", () => {
    const result = calculateIndividualScore(raw(), []);
    expect(result.finalScore).toBe(3);
    expect(result.hasIncompleteData).toBe(false);
  });

  it("scores the worst possible agent exactly 0.00", () => {
    const result = calculateIndividualScore(
      raw({
        avgFirstResponseTimeSec: 999,
        avgResponseTimeSec: 999,
        emailAHTSec: 999 * 60,
        appAHTSec: 999 * 60,
        csatCount: 0,
        dsatCount: 100,
        qaAuditPct: 0,
      }),
      []
    );
    expect(result.finalScore).toBe(0);
  });

  describe("Application AHT (35%) boundaries — Proposed Individual Grading Scales", () => {
    it("grades exactly 20 min as Exceptional (3)", () => {
      const r = calculateIndividualScore(raw({ appAHTSec: 20 * 60 }), []);
      expect(r.metrics.find((m) => m.key === "appAHT")!.grade).toBe(3);
    });
    it("grades 20.01 min as On Target (2)", () => {
      const r = calculateIndividualScore(raw({ appAHTSec: 20.01 * 60 }), []);
      expect(r.metrics.find((m) => m.key === "appAHT")!.grade).toBe(2);
    });
    it("grades exactly 25 min as On Target (2)", () => {
      const r = calculateIndividualScore(raw({ appAHTSec: 25 * 60 }), []);
      expect(r.metrics.find((m) => m.key === "appAHT")!.grade).toBe(2);
    });
    it("grades 25.01 min as Below Target (1)", () => {
      const r = calculateIndividualScore(raw({ appAHTSec: 25.01 * 60 }), []);
      expect(r.metrics.find((m) => m.key === "appAHT")!.grade).toBe(1);
    });
    it("grades exactly 30 min as Below Target (1)", () => {
      const r = calculateIndividualScore(raw({ appAHTSec: 30 * 60 }), []);
      expect(r.metrics.find((m) => m.key === "appAHT")!.grade).toBe(1);
    });
    it("grades 30.01 min as Failing (0)", () => {
      const r = calculateIndividualScore(raw({ appAHTSec: 30.01 * 60 }), []);
      expect(r.metrics.find((m) => m.key === "appAHT")!.grade).toBe(0);
    });
  });

  describe("Chat Avg Response Time (15%) — per the stated table, not the framework's inconsistent example", () => {
    it("grades exactly 19 sec as Exceptional (3)", () => {
      const r = calculateIndividualScore(raw({ avgResponseTimeSec: 19 }), []);
      expect(r.metrics.find((m) => m.key === "chatAvgResponse")!.grade).toBe(3);
    });
    it("grades 25 sec as On Target (2) — the framework's own example incorrectly grades this a 3", () => {
      const r = calculateIndividualScore(raw({ avgResponseTimeSec: 25 }), []);
      expect(r.metrics.find((m) => m.key === "chatAvgResponse")!.grade).toBe(2);
    });
    it("grades 30.01 sec as Failing (0)", () => {
      const r = calculateIndividualScore(raw({ avgResponseTimeSec: 30.01 }), []);
      expect(r.metrics.find((m) => m.key === "chatAvgResponse")!.grade).toBe(0);
    });
  });

  describe("CSAT/DSAT (10%) — per the stated table, not the framework's inconsistent example", () => {
    it("92% grades On Target (2) — the framework's own example incorrectly grades this a 3", () => {
      const r = calculateIndividualScore(raw({ csatCount: 92, dsatCount: 8 }), []);
      expect(r.metrics.find((m) => m.key === "csatDsat")!.grade).toBe(2);
    });
    it("exactly 95% grades Exceptional (3)", () => {
      const r = calculateIndividualScore(raw({ csatCount: 95, dsatCount: 5 }), []);
      expect(r.metrics.find((m) => m.key === "csatDsat")!.grade).toBe(3);
    });
    it("79% grades Failing (0)", () => {
      const r = calculateIndividualScore(raw({ csatCount: 79, dsatCount: 21 }), []);
      expect(r.metrics.find((m) => m.key === "csatDsat")!.grade).toBe(0);
    });
  });

  it("excludes a missing metric and renormalizes rather than scoring it 0", () => {
    const withQa = calculateIndividualScore(raw({ qaAuditPct: 96 }), []);
    const withoutQa = calculateIndividualScore(raw({ qaAuditPct: null }), []);
    expect(withQa.finalScore).toBe(3);
    expect(withoutQa.hasIncompleteData).toBe(true);
    expect(withoutQa.metrics.find((m) => m.key === "qaAudit")!.excluded).toBe(true);
    expect(withoutQa.finalScore).toBe(3); // still perfect on the metrics that ARE present
  });

  it("applies penalty deductions before the (separately-applied) gate multiplier, floored at 0", () => {
    const r = calculateIndividualScore(raw(), [
      {
        id: "p1",
        agentId: "test-agent",
        periodId: "test-period",
        code: "major_quality_defect",
        count: 1,
        occurredOn: "2026-09-01",
      },
    ]);
    expect(r.penaltyTotal).toBe(0.2);
    expect(r.finalScore).toBe(2.8);
  });

  it("never goes below 0 even with penalties far exceeding the base score", () => {
    const r = calculateIndividualScore(raw(), [
      {
        id: "p1",
        agentId: "test-agent",
        periodId: "test-period",
        code: "unexcused_absence",
        count: 10,
        occurredOn: "2026-09-01",
      },
    ]);
    expect(r.finalScore).toBe(0);
  });
});

describe("deriveCsatPercent", () => {
  it("computes 100 - (DSAT / Total Chats) * 100", () => {
    expect(deriveCsatPercent(500, 20)).toBe(96);
    expect(deriveCsatPercent(10, 1)).toBe(90);
  });
  it("returns null when there's no chat volume to divide by", () => {
    expect(deriveCsatPercent(0, 0)).toBeNull();
    expect(deriveCsatPercent(null, null)).toBeNull();
  });
});
