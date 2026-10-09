// The Raw Data page's change history: one record per edit/delete, always with
// the reason the person typed. Stored in the existing `audit_logs` table
// (schema.sql already defines it for exactly this kind of record and nothing
// else writes to it, so no new table / SQL is needed). That table has no
// anon read policy by design, so everything here goes through the
// service-role client -- and only ever runs server-side, behind the
// Lead/Manager password check (see app/raw-data/actions.ts).
//
// When Supabase isn't configured (the zero-config in-memory mode), the log
// is kept in memory too, same as every other piece of data in that mode.
import { getSupabaseServiceClient } from "./supabaseClient";
import type { RawDataChange } from "./rawDataFields";

const ENTITY = "raw_data";

function usesSupabase(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

const globalKey = "__kycRawDataChangeLog__";
type GlobalWithLog = typeof globalThis & { [globalKey]?: RawDataChange[] };
const g = globalThis as GlobalWithLog;
if (!g[globalKey]) g[globalKey] = [];
const memoryLog: RawDataChange[] = g[globalKey]!;

type NewChange = Omit<RawDataChange, "id" | "createdAt">;

export async function addRawDataChange(entry: NewChange): Promise<RawDataChange> {
  if (!usesSupabase()) {
    const record: RawDataChange = { ...entry, id: `chg_${Date.now()}_${memoryLog.length}`, createdAt: new Date().toISOString() };
    memoryLog.unshift(record);
    return record;
  }

  const { data, error } = await getSupabaseServiceClient()
    .from("audit_logs")
    .insert({
      actor: entry.changedBy,
      action: entry.action,
      entity: ENTITY,
      entity_id: `${entry.agentId}:${entry.date}`,
      detail: {
        reason: entry.reason,
        agentId: entry.agentId,
        agentName: entry.agentName,
        date: entry.date,
        changes: entry.changes,
      },
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  const row = data as { id: string; created_at: string };
  return { ...entry, id: row.id, createdAt: row.created_at };
}

export async function listRawDataChanges(limit = 300): Promise<RawDataChange[]> {
  if (!usesSupabase()) return memoryLog.slice(0, limit);

  const { data, error } = await getSupabaseServiceClient()
    .from("audit_logs")
    .select("id, actor, action, entity_id, detail, created_at")
    .eq("entity", ENTITY)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const detail = (row.detail ?? {}) as Record<string, unknown>;
    return {
      id: String(row.id),
      createdAt: String(row.created_at),
      action: row.action === "delete" ? "delete" : "edit",
      changedBy: String(row.actor ?? ""),
      reason: String(detail.reason ?? ""),
      agentId: String(detail.agentId ?? ""),
      agentName: String(detail.agentName ?? ""),
      date: String(detail.date ?? ""),
      changes: Array.isArray(detail.changes) ? (detail.changes as RawDataChange["changes"]) : [],
    } satisfies RawDataChange;
  });
}
