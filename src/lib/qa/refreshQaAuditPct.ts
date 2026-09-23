// Recomputes — or clears — the qaAuditPct written onto one agent's
// scorecard for one period, purely from whichever QA audits are currently
// PUBLISHED for that agent+period. This is the exact same blend the
// publish route computes (average of every published audit's percentage,
// rounded to 1 decimal), so calling this after publish leaves the number
// unchanged — it's meant to be called after anything that can change the
// PUBLISHED set for an agent+period: publishing an audit (see
// publish/route.ts, which now calls this too instead of writing the blend
// itself) and, critically, deleting one — published or not (see
// [id]/route.ts's DELETE handler).
//
// Why this can't reuse commitImportRows(): that helper has a deliberate
// guard — `row.parsedValue !== null` — that stops it from ever WRITING a
// null, specifically so a bad/unparseable import row can never silently
// erase existing data. But "the audit that was carrying this agent's QA
// score just got deleted, and no other published audit exists for this
// agent+period" is a real, intended state, and the scorecard's QA Audit %
// has to be able to go back to null (not measured) when that happens.
// commitImportRows's guard would make that impossible. So this instead
// calls repo.commitImport() directly — the lower-level write
// commitImportRows itself ultimately calls — passing the FULL existing
// metrics array for the period with only this one agent's qaAuditPct field
// changed, which preserves every other agent's data exactly as it was
// (same merge-by-hand pattern commitImportRows uses internally) while
// still allowing null through.
import { getRepository } from "@/lib/data/repository";
import type { RawAgentMetrics, RawGateMetrics } from "@/lib/scoring/types";

export interface RefreshQaAuditPctResult {
  qaAuditPct: number | null;
  blendedFrom: number;
}

export async function refreshQaAuditPct(agentId: string, periodId: string): Promise<RefreshQaAuditPctResult> {
  const repo = await getRepository();

  const [audits, periods, existingMetrics, existingGate] = await Promise.all([
    repo.getQaAudits({ agentId, periodId }),
    repo.getPeriods(),
    repo.getRawMetrics(periodId),
    repo.getGateMetrics(periodId),
  ]);

  const period = periods.find((p) => p.id === periodId);
  if (!period) {
    // The period itself is gone (e.g. that whole day was separately
    // deleted) — nothing left to write onto.
    return { qaAuditPct: null, blendedFrom: 0 };
  }

  const scored = audits.filter((a) => a.status === "published" && a.percentage !== null);
  const qaAuditPct =
    scored.length === 0 ? null : Math.round((scored.reduce((sum, a) => sum + (a.percentage as number), 0) / scored.length) * 10) / 10;

  // Nothing to do if the number on the scorecard already matches (avoids a
  // pointless write — and a pointless new import-trail row — on every
  // delete of an audit that was never published in the first place).
  const currentRow = existingMetrics.find((m) => m.agentId === agentId);
  if ((currentRow?.qaAuditPct ?? null) === qaAuditPct) {
    return { qaAuditPct, blendedFrom: scored.length };
  }

  // Preserve the existing Business Gate values for this period untouched —
  // only mint an all-null one if this period genuinely has none yet.
  const gate: RawGateMetrics = existingGate ?? {
    periodId,
    clientAvgWaitTimeMin: null,
    teamProcessingTimeMin: null,
    chatTeamAvgResponseSec: null,
    teamTicketAHTMin: null,
  };

  // Preserve every other agent's row untouched; only this one agent's
  // qaAuditPct changes. If this agent has no row yet for this period at all
  // (an audit exists for a period this agent otherwise has zero imported
  // metrics for — unusual, but not impossible), mint a fully-null one so
  // the write still lands.
  const blankRow: RawAgentMetrics = {
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
    emailTicketCount: null,
  };
  const metrics = currentRow
    ? existingMetrics.map((m) => (m.agentId === agentId ? { ...m, qaAuditPct } : m))
    : [...existingMetrics, { ...blankRow, qaAuditPct }];

  const { record } = await repo.createImport(
    {
      fileName:
        qaAuditPct === null
          ? "QA Audit recompute — no published audits remain, clearing scorecard"
          : `QA Audit recompute — ${scored.length} published audit${scored.length === 1 ? "" : "s"} blended`,
      uploadedAt: new Date().toISOString(),
      periodLabel: null,
      status: "pending_review",
      rowCount: 1,
    },
    [
      {
        agentNameRaw: agentId,
        matchedAgentId: agentId,
        metricKey: "qaAuditPct",
        rawValue: qaAuditPct === null ? "cleared" : String(qaAuditPct),
        parsedValue: qaAuditPct,
        status: "extracted",
      },
    ]
  );

  await repo.commitImport(record.id, period, metrics, gate);

  return { qaAuditPct, blendedFrom: scored.length };
}
