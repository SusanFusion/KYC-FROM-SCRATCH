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

export interface DataRepository {
  getTeams(): Promise<Team[]>;
  getAgents(): Promise<Agent[]>;
  getPeriods(): Promise<Period[]>;
  getRawMetrics(periodId?: string): Promise<RawAgentMetrics[]>;
  getGateMetrics(periodId: string): Promise<RawGateMetrics | null>;
  getAllGateMetrics(): Promise<RawGateMetrics[]>;
  getPenalties(periodId?: string): Promise<PenaltyEntry[]>;
  addPenalty(entry: Omit<PenaltyEntry, "id">): Promise<PenaltyEntry>;

  getImports(): Promise<ImportRecord[]>;
  createImport(record: Omit<ImportRecord, "id">, rows: Omit<ImportRow, "id" | "importId">[]): Promise<{ record: ImportRecord; rows: ImportRow[] }>;
  getImportRows(importId: string): Promise<ImportRow[]>;
  commitImport(
    importId: string,
    period: Omit<Period, "id"> & { id?: string },
    metrics: RawAgentMetrics[],
    gate: RawGateMetrics
  ): Promise<Period>;
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
