// Repository abstraction — see README.md "Data architecture" section.
//
// Raw imported data and calculated scores are kept strictly separate: this
// layer only ever stores/returns RAW metrics (agents, teams, periods, raw
// per-agent numbers, penalty records, import records). Scores, gate
// multipliers and bonuses are always derived on read by the /scoring engine
// — never persisted — so changing a scoring rule instantly re-scores every
// period without a data migration.
import type { Agent, ImportRecord, ImportRow, Period, Team } from "@/types/domain";
import type { PenaltyEntry, RawAgentMetrics, RawGateMetrics } from "@/lib/scoring/types";
import type { NewQaAuditInput, QaAuditRecord, QaAuditStatus, QaAuditType } from "@/lib/qa/auditDefinitions";

export interface DataRepository {
  getTeams(): Promise<Team[]>;
  getAgents(): Promise<Agent[]>;
  getPeriods(): Promise<Period[]>;
  getRawMetrics(periodId?: string): Promise<RawAgentMetrics[]>;
  getGateMetrics(periodId: string): Promise<RawGateMetrics | null>;
  getAllGateMetrics(): Promise<RawGateMetrics[]>;
  getPenalties(periodId?: string): Promise<PenaltyEntry[]>;
  addPenalty(entry: Omit<PenaltyEntry, "id">): Promise<PenaltyEntry>;
  deletePenalty(id: string): Promise<void>;

  getImports(): Promise<ImportRecord[]>;
  createImport(record: Omit<ImportRecord, "id">, rows: Omit<ImportRow, "id" | "importId">[]): Promise<{ record: ImportRecord; rows: ImportRow[] }>;
  getImportRows(importId: string): Promise<ImportRow[]>;
  commitImport(
    importId: string,
    period: Omit<Period, "id"> & { id?: string },
    metrics: RawAgentMetrics[],
    gate: RawGateMetrics
  ): Promise<Period>;

  /** Removes just this import's own audit-trail record (and its parsed
   *  rows) — never touches a period or its data. Use this when the import's
   *  periodId is shared with another import (deleting the period would
   *  also erase what that other import contributed), or when it has no
   *  periodId at all (never committed, or committed before that link
   *  existed). See deletePeriod for the "wipe this whole day" case. */
  deleteImport(importId: string): Promise<void>;

  /** Removes a period and everything stored against it — its raw
   *  individual metrics, its Business Gate metrics, any penalties logged
   *  against it, and any import records that point to it (with their
   *  rows) — so it's immediately gone from every page that reads periods
   *  (Team Performance, Trends, Overall MTD, Dashboard, Rankings,
   *  Scorecards, Reports, Penalties). This is what "delete an imported
   *  file so it's no longer read anywhere" actually means for a period
   *  that only one import ever touched — the normal case now that every
   *  import mints its own daily period. */
  deletePeriod(periodId: string): Promise<void>;

  // QA Audits — see src/lib/qa/auditDefinitions.ts. Kept entirely separate
  // from the raw-metrics tables above: an audit is its own confidential
  // record, and "publish" (see /api/qa-audits/[id]/publish) writes its
  // computed score into performance_entries.qa_audit_pct through the
  // EXISTING commitImportRows() path, the same merge-safe write every PDF
  // import and manual entry already goes through — so no new method was
  // needed here for that half of the feature, only for the audits
  // themselves.
  getQaAudits(filter?: { auditType?: QaAuditType; periodId?: string; agentId?: string }): Promise<QaAuditRecord[]>;
  getQaAuditById(id: string): Promise<QaAuditRecord | null>;
  createQaAudit(input: NewQaAuditInput & { applicablePoints: number; totalPoints: number; percentage: number | null; autoFail: boolean; band: 0 | 1 | 2 | 3 | null }): Promise<QaAuditRecord>;
  setQaAuditStatus(id: string, status: QaAuditStatus): Promise<QaAuditRecord>;
  deleteQaAudit(id: string): Promise<void>;
}

let cachedRepo: DataRepository | null = null;

/**
 * Returns the active repository. When Supabase env vars are present, uses
 * the Supabase-backed implementation (durable persistence). Otherwise falls
 * back to an in-memory store seeded from the source PDF data — this is what
 * lets the app run and demo correctly on Vercel with ZERO configuration,
 * per the build requirement of "no missing environment variables at build
 * time" — but it is NOT durable: it resets on every cold start. See
 * .env.example and README.md.
 */
export async function getRepository(): Promise<DataRepository> {
  if (cachedRepo) return cachedRepo;

  const hasSupabase =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (hasSupabase) {
    const { SupabaseRepository } = await import("./supabaseRepository");
    cachedRepo = new SupabaseRepository();
  } else {
    const { LocalRepository } = await import("./localRepository");
    cachedRepo = new LocalRepository();
  }
  return cachedRepo;
}
