// Shared "rows[] + gate → committed period" logic used by both the PDF
// import commit step (/api/import/commit) and manual data entry
// (/api/import/manual). Keeping this in one place means both paths update
// the dashboard/rankings/scorecards identically — they both ultimately just
// write RawAgentMetrics + RawGateMetrics for a period via the repository,
// which every page reads fresh through loadPeriodDataset (see query.ts).
import { getRepository } from "./repository";
import type { RawAgentMetrics, RawGateMetrics } from "@/lib/scoring/types";
import type { ImportRow, Period } from "@/types/domain";

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
    // Every import — PDF or manual — is now a single day's snapshot (see the
    // daily-import redesign): the date confirmed on the Data Import page IS
    // the whole period, so start and end are always that same day.
    //
    // This used to branch on whether the imported PDF's own auto-extracted
    // "Date Range" text happened to contain the word "month" (tagging the
    // period "month-to-date" with startDate forced back to the 1st of the
    // month) — a leftover from before daily imports existed, when a single
    // ongoing monthly period was the only shape a period could take. An
    // MTD-status PDF's own header text very often DOES contain the word
    // "month" (e.g. "Date Range: Month to Date"), which has nothing to do
    // with what day this particular import actually covers — so that guess
    // was silently minting periods whose startDate !== endDate. Those never
    // match getDailyPeriods()'s `startDate === endDate` test, which means
    // they were invisible to the weekly filter, Trends, and the Overall MTD
    // tab: exactly the bug where an imported day's data never showed up
    // anywhere that aggregates by day. Overall MTD is now computed on the
    // fly by aggregating daily periods (see loadRangeDataset), so there's no
    // remaining reason to ever store an import as anything but a daily one.
    periodId = `import-${endDateIso}-${importId.slice(-6)}`;
    period = {
      id: periodId,
      label: periodLabel ? `${periodLabel} (imported ${endDateIso})` : `Imported period (${endDateIso})`,
      type: "daily",
      startDate: endDateIso,
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
