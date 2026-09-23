// Recomputes — or reverts — the qaAuditPct written onto one agent's
// scorecard for one period, based on whichever QA audits are currently
// PUBLISHED for that agent+period. This is the exact same blend the
// publish route computes (average of every published audit's percentage,
// rounded to 1 decimal), so calling this after publish leaves the number
// unchanged — it's meant to be called after anything that can change the
// PUBLISHED set for an agent+period: publishing an audit (see
// publish/route.ts, which now calls this too instead of writing the blend
// itself) and, critically, deleting one — published or not (see
// [id]/route.ts's DELETE handler).
//
// IMPORTANT — qaAuditPct is a single shared field, not audit-only: Data
// Import (a PDF upload or Manual Entry) can ALSO set an agent's qaAuditPct
// directly for a period, with no audit record involved at all (see
// ManualEntryForm.tsx / import/manual/route.ts — this predates the Audit
// feature and Susan still uses it). Publishing an audit for a period
// deliberately overwrites whatever Manual Entry/PDF value was already
// there (see publish/route.ts's own comment — "audits are just a new,
// structured way of arriving at the same number"). But when the LAST
// published audit for a period is deleted, this must NOT simply wipe the
// field to null — if a Manual Entry or PDF import had already set a real
// value there (before or after the audit existed), that's the value that
// should reappear, exactly as if the audit had never been published.
// lastNonAuditQaAuditPct() below finds that value by walking committed
// imports for this exact period, most-recent-first, skipping the ones this
// file itself created ("QA Audit publish —" / "QA Audit recompute —"), and
// returns the first row it finds for this agent's qaAuditPct metric. Only
// if nothing turns up is the field actually cleared to null.
//
// Why this can't reuse commitImportRows(): that helper has a deliberate
// guard — `row.parsedValue !== null` — that stops it from ever WRITING a
// null, specifically so a bad/unparseable import row can never silently
// erase existing data. But "clear back to null because nothing — no
// published audit, no earlier Manual Entry/PDF value — actually measured
// this agent's QA this period" is a real, intended state. commitImportRows's
// guard would make that impossible. So this instead calls
// repo.commitImport() directly — the lower-level write commitImportRows
// itself ultimately calls — passing the FULL existing metrics array for
// the period with only this one agent's qaAuditPct field changed, which
// preserves every other agent's data exactly as it was (same
// merge-by-hand pattern commitImportRows uses internally) while still
// allowing null through.
import { getRepository } from "@/lib/data/repository";
import type { RawAgentMetrics, RawGateMetrics } from "@/lib/scoring/types";

export interface RefreshQaAuditPctResult {
  qaAuditPct: number | null;
  blendedFrom: number;
  /** true when qaAuditPct came from falling back to an earlier Manual
   *  Entry/PDF import value (no published audits remain), not from a live
   *  audit blend and not a hard clear to null. Lets the caller show an
   *  accurate message instead of implying the number was wiped. */
  restoredFromImport: boolean;
}

type Repo = Awaited<ReturnType<typeof getRepository>>;

async function lastNonAuditQaAuditPct(repo: Repo, agentId: string, periodId: string): Promise<number | null> {
  const imports = await repo.getImports();
  // Both repository implementations already return getImports() sorted
  // most-recent-first (see supabaseRepository.ts / localRepository.ts), so
  // the first match found below is genuinely the latest one.
  const candidates = imports.filter(
    (imp) => imp.status === "committed" && imp.periodId === periodId && !imp.fileName.startsWith("QA Audit ")
  );
  for (const imp of candidates) {
    const rows = await repo.getImportRows(imp.id);
    const row = rows.find((r) => r.matchedAgentId === agentId && r.metricKey === "qaAuditPct" && r.status !== "failed" && r.parsedValue !== null);
    if (row) return row.parsedValue;
  }
  return null;
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
    return { qaAuditPct: null, blendedFrom: 0, restoredFromImport: false };
  }

  const scored = audits.filter((a) => a.status === "published" && a.percentage !== null);

  let qaAuditPct: number | null;
  let restoredFromImport = false;
  if (scored.length > 0) {
    qaAuditPct = Math.round((scored.reduce((sum, a) => sum + (a.percentage as number), 0) / scored.length) * 10) / 10;
  } else {
    qaAuditPct = await lastNonAuditQaAuditPct(repo, agentId, periodId);
    restoredFromImport = qaAuditPct !== null;
  }

  // Nothing to do if the number on the scorecard already matches (avoids a
  // pointless write — and a pointless new import-trail row — on every
  // delete of an audit that was never published in the first place).
  const currentRow = existingMetrics.find((m) => m.agentId === agentId);
  if ((currentRow?.qaAuditPct ?? null) === qaAuditPct) {
    return { qaAuditPct, blendedFrom: scored.length, restoredFromImport };
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
        scored.length > 0
          ? `QA Audit recompute — ${scored.length} published audit${scored.length === 1 ? "" : "s"} blended`
          : restoredFromImport
            ? "QA Audit recompute — no published audits remain, reverted to last Manual Entry/Import value"
            : "QA Audit recompute — no published audits remain, clearing scorecard",
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

  return { qaAuditPct, blendedFrom: scored.length, restoredFromImport };
}
