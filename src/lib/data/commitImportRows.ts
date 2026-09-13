// Shared "rows[] + gate → committed period" logic used by both the PDF
// import commit step (/api/import/commit) and manual data entry
// (/api/import/manual). Keeping this in one place means both paths update
// the dashboard/rankings/scorecards identically — they both ultimately just
// write RawAgentMetrics + RawGateMetrics for a period via the repository,
// which every page reads fresh through loadPeriodDataset (see query.ts).
import { getRepository } from "./repository";
import type { RawAgentMetrics, RawGateMetrics } from "@/lib/scoring/types";
import type { ImportRow, Period, PeriodType } from "@/types/domain";

export interface CommitImportRowsParams {
  importId: string;
  rows: ImportRow[];
  periodLabel?: string | null;
  /** Already-resolved YYYY-MM-DD — callers own parsing whatever date format they received. */
  endDateIso: string;
  gate?: Partial<RawGateMetrics>;
}

export type CommitImportRowsResult =
  | { ok: true; period: Period; agentsUpdated: number }
  | { ok: false; error: string };

export async function commitImportRows(params: CommitImportRowsParams): Promise<CommitImportRowsResult> {
  const { importId, rows, periodLabel, endDateIso, gate: gateInput } = params;

  const validRows = rows.filter((r) => r.status !== "failed" && r.matchedAgentId);
  if (validRows.length === 0) {
    return {
      ok: false,
      error: "No valid rows to commit. Resolve the flagged rows first (unmatched agents or failed parses).",
    };
  }

  const isMonth = /month/i.test(periodLabel ?? "");
  const startDate = isMonth ? `${endDateIso.slice(0, 7)}-01` : endDateIso;
  const periodType: PeriodType = isMonth ? "month-to-date" : "custom";
  const periodId = `import-${endDateIso}-${importId.slice(-6)}`;

  const period: Omit<Period, "id"> & { id?: string } = {
    id: periodId,
    label: periodLabel ? `${periodLabel} (imported ${endDateIso})` : `Imported period (${endDateIso})`,
    type: periodType,
    startDate,
    endDate: endDateIso,
    generatedAt: endDateIso,
  };

  const byAgent = new Map<string, RawAgentMetrics>();
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
    }
  }

  const gate: RawGateMetrics = {
    periodId,
    clientAvgWaitTimeMin: gateInput?.clientAvgWaitTimeMin ?? null,
    teamProcessingTimeMin: gateInput?.teamProcessingTimeMin ?? null,
    chatTeamAvgResponseSec: gateInput?.chatTeamAvgResponseSec ?? null,
    teamTicketAHTMin: gateInput?.teamTicketAHTMin ?? null,
  };

  const repo = await getRepository();
  const committedPeriod = await repo.commitImport(importId, period, [...byAgent.values()], gate);
  return { ok: true, period: committedPeriod, agentsUpdated: byAgent.size };
}
