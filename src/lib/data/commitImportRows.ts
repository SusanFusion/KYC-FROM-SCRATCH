// Shared "rows[] + gate → committed period" logic used by both the PDF
// import commit step (/api/import/commit) and manual data entry
// (/api/import/manual). Keeping this in one place means both paths update
// the dashboard/rankings/scorecards identically — they both ultimately just
// write RawAgentMetrics + RawGateMetrics for a period via the repository,
// which every page reads fresh through loadPeriodDataset (see query.ts).
import { getRepository } from "./repository";
import type { RawAgentMetrics, RawGateMetrics } from "@/lib/scoring/types";
import type { ImportRow, Period, PeriodType } from "@/types/domain";

const GATE_FIELD_KEYS = ["clientAvgWaitTimeMin", "teamProcessingTimeMin", "chatTeamAvgResponseSec", "teamTicketAHTMin"] as const;

export interface CommitImportRowsParams {
  importId: string;
  rows: ImportRow[];
  periodLabel?: string | null;
  /** Already-resolved YYYY-MM-DD — callers own parsing whatever date format they received. */
  endDateIso: string;
  gate?: Partial<RawGateMetrics>;
  /**
   * When set (and it matches a real, existing period), this commit MERGES
   * into that period instead of minting a brand new one: only the fields
   * actually present in this commit are written — every other agent's
   * metrics, and every other Business Gate field, already stored for that
   * period are preserved untouched. This is what lets, e.g., a PDF import
   * (individual metrics) and a later manual entry (the two Business Gate
   * fields the PDF never reports) both land on the SAME period instead of
   * silently creating a second period that never shows up as "current".
   */
  targetPeriodId?: string | null;
}

export type CommitImportRowsResult =
  | { ok: true; period: Period; agentsUpdated: number }
  | { ok: false; error: string };

export async function commitImportRows(params: CommitImportRowsParams): Promise<CommitImportRowsResult> {
  const { importId, rows, periodLabel, endDateIso, gate: gateInput, targetPeriodId } = params;

  const validRows = rows.filter((r) => r.status !== "failed" && r.matchedAgentId);
  const hasGateValue = Object.values(gateInput ?? {}).some((v) => typeof v === "number" && Number.isFinite(v));
  // A commit needs SOME data, but not necessarily both kinds — a manual
  // entry of only the two Business Gate fields the team actually has this
  // week, with zero individual rows, is a completely valid partial period
  // (it updates the gate multiplier; individual scores simply stay "no
  // data" until a later import adds them, same as any other missing metric).
  if (validRows.length === 0 && !hasGateValue) {
    return {
      ok: false,
      error: "No data to commit. Enter at least one agent metric or one Business Gate value.",
    };
  }

  const repo = await getRepository();

  let existingPeriod: Period | null = null;
  if (targetPeriodId) {
    const periods = await repo.getPeriods();
    existingPeriod = periods.find((p) => p.id === targetPeriodId) ?? null;
  }

  let periodId: string;
  let period: Omit<Period, "id"> & { id?: string };

  if (existingPeriod) {
    // Merging into a period that already exists — its own label/dates/type
    // are the source of truth; this commit only adds/updates metric values.
    periodId = existingPeriod.id;
    period = existingPeriod;
  } else {
    const isMonth = /month/i.test(periodLabel ?? "");
    const startDate = isMonth ? `${endDateIso.slice(0, 7)}-01` : endDateIso;
    // A same-day import (startDate === endDateIso, i.e. not a "month"
    // label) is a daily period — tagging it "daily" rather than the old
    // catch-all "custom" is what lets the Team Performance/Trends weekly
    // filter and the Overall MTD tab find and aggregate these periods (see
    // query.ts's getDailyPeriods, which matches on startDate === endDate
    // regardless of this type label, but the explicit type keeps intent
    // clear rather than implicit).
    const periodType: PeriodType = isMonth ? "month-to-date" : "daily";
    periodId = `import-${endDateIso}-${importId.slice(-6)}`;
    period = {
      id: periodId,
      label: periodLabel ? `${periodLabel} (imported ${endDateIso})` : `Imported period (${endDateIso})`,
      type: periodType,
      startDate,
      endDate: endDateIso,
      generatedAt: endDateIso,
    };
  }

  // Seed from whatever this period already has stored (when merging) so
  // fields this particular commit doesn't touch keep their previous values
  // instead of being reset to null/blank — a partial update (e.g. "just the
  // two Business Gate numbers today") must never erase data an earlier
  // import already established for this same period.
  const existingMetrics = existingPeriod ? await repo.getRawMetrics(periodId) : [];
  const byAgent = new Map<string, RawAgentMetrics>(existingMetrics.map((m) => [m.agentId, { ...m, periodId }]));
  const touchedAgentIds = new Set<string>();

  for (const row of validRows) {
    const agentId = row.matchedAgentId!;
    if (!byAgent.has(agentId)) {
      byAgent.set(agentId, {
        agentId,
        periodId,
        totalChatConversations: null,
        avgFirstResponseTimeSec: null,
        avgResponseTimeSec: null,
        emailAHTSec: null,
        appAHTSec: null,
        totalChats: null,
        csatCount: null,
        dsatCount: null,
        qaAuditPct: null,
      });
    }
    const entry = byAgent.get(agentId)!;
    if (row.metricKey in entry && row.parsedValue !== null) {
      (entry as unknown as Record<string, number | null>)[row.metricKey] = row.parsedValue;
      touchedAgentIds.add(agentId);
    }
  }

  const existingGate = existingPeriod ? await repo.getGateMetrics(periodId) : null;
  const gate: RawGateMetrics = { periodId, clientAvgWaitTimeMin: null, teamProcessingTimeMin: null, chatTeamAvgResponseSec: null, teamTicketAHTMin: null };
  for (const key of GATE_FIELD_KEYS) {
    const provided = gateInput?.[key];
    gate[key] = typeof provided === "number" && Number.isFinite(provided) ? provided : (existingGate?.[key] ?? null);
  }

  const committedPeriod = await repo.commitImport(importId, period, [...byAgent.values()], gate);
  return { ok: true, period: committedPeriod, agentsUpdated: touchedAgentIds.size };
}
