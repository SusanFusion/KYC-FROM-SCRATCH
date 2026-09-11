import type { DataRepository } from "./repository";
import type { Agent, ImportRecord, ImportRow, Period, Team } from "@/types/domain";
import type { PenaltyEntry, RawAgentMetrics, RawGateMetrics } from "@/lib/scoring/types";
import { getSupabaseClient } from "./supabaseClient";

/**
 * Supabase-backed repository. Mirrors LocalRepository's contract exactly so
 * UI code never needs to know which one it's talking to. See
 * supabase/schema.sql for the table definitions this expects.
 */
export class SupabaseRepository implements DataRepository {
  private get client() {
    return getSupabaseClient();
  }

  async getTeams(): Promise<Team[]> {
    const { data, error } = await this.client.from("teams").select("*");
    if (error) throw error;
    return data ?? [];
  }

  async getAgents(): Promise<Agent[]> {
    const { data, error } = await this.client.from("agents").select("*").order("name");
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      teamId: row.team_id as string,
      department: row.department as string,
      status: row.status as Agent["status"],
      tenureEligible: Boolean(row.tenure_eligible),
      createdAt: row.created_at as string,
    }));
  }

  async getPeriods(): Promise<Period[]> {
    const { data, error } = await this.client.from("periods").select("*").order("start_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      label: row.label as string,
      type: row.type as Period["type"],
      startDate: row.start_date as string,
      endDate: row.end_date as string,
      generatedAt: row.generated_at as string,
    }));
  }

  async getRawMetrics(periodId?: string): Promise<RawAgentMetrics[]> {
    let query = this.client.from("performance_entries").select("*");
    if (periodId) query = query.eq("period_id", periodId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapPerformanceRow);
  }

  async getGateMetrics(periodId: string): Promise<RawGateMetrics | null> {
    const { data, error } = await this.client
      .from("gate_metrics")
      .select("*")
      .eq("period_id", periodId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapGateRow(data) : null;
  }

  async getAllGateMetrics(): Promise<RawGateMetrics[]> {
    const { data, error } = await this.client.from("gate_metrics").select("*");
    if (error) throw error;
    return (data ?? []).map(mapGateRow);
  }

  async getPenalties(periodId?: string): Promise<PenaltyEntry[]> {
    let query = this.client.from("penalties").select("*");
    if (periodId) query = query.eq("period_id", periodId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      agentId: row.agent_id as string,
      periodId: row.period_id as string,
      code: row.code as PenaltyEntry["code"],
      count: row.count as number,
      note: (row.note as string) ?? undefined,
      occurredOn: row.occurred_on as string,
    }));
  }

  async addPenalty(entry: Omit<PenaltyEntry, "id">): Promise<PenaltyEntry> {
    const { data, error } = await this.client
      .from("penalties")
      .insert({
        agent_id: entry.agentId,
        period_id: entry.periodId,
        code: entry.code,
        count: entry.count,
        note: entry.note ?? null,
        occurred_on: entry.occurredOn,
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      agentId: data.agent_id,
      periodId: data.period_id,
      code: data.code,
      count: data.count,
      note: data.note ?? undefined,
      occurredOn: data.occurred_on,
    };
  }

  async getImports(): Promise<ImportRecord[]> {
    const { data, error } = await this.client.from("imports").select("*").order("uploaded_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      fileName: row.file_name as string,
      uploadedAt: row.uploaded_at as string,
      periodLabel: (row.period_label as string) ?? null,
      status: row.status as ImportRecord["status"],
      rowCount: row.row_count as number,
      committedAt: (row.committed_at as string) ?? undefined,
    }));
  }

  async createImport(
    record: Omit<ImportRecord, "id">,
    rows: Omit<ImportRow, "id" | "importId">[]
  ): Promise<{ record: ImportRecord; rows: ImportRow[] }> {
    const { data: importRow, error } = await this.client
      .from("imports")
      .insert({
        file_name: record.fileName,
        uploaded_at: record.uploadedAt,
        period_label: record.periodLabel,
        status: record.status,
        row_count: record.rowCount,
      })
      .select()
      .single();
    if (error) throw error;

    const importId = importRow.id as string;
    const { data: rowData, error: rowError } = await this.client
      .from("import_rows")
      .insert(
        rows.map((r) => ({
          import_id: importId,
          agent_name_raw: r.agentNameRaw,
          matched_agent_id: r.matchedAgentId,
          metric_key: r.metricKey,
          raw_value: r.rawValue,
          parsed_value: r.parsedValue,
          status: r.status,
          note: r.note ?? null,
        }))
      )
      .select();
    if (rowError) throw rowError;

    return {
      record: { ...record, id: importId },
      rows: (rowData ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        importId,
        agentNameRaw: r.agent_name_raw as string,
        matchedAgentId: (r.matched_agent_id as string) ?? null,
        metricKey: r.metric_key as string,
        rawValue: r.raw_value as string,
        parsedValue: (r.parsed_value as number) ?? null,
        status: r.status as ImportRow["status"],
        note: (r.note as string) ?? undefined,
      })),
    };
  }

  async getImportRows(importId: string): Promise<ImportRow[]> {
    const { data, error } = await this.client.from("import_rows").select("*").eq("import_id", importId);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      importId,
      agentNameRaw: r.agent_name_raw as string,
      matchedAgentId: (r.matched_agent_id as string) ?? null,
      metricKey: r.metric_key as string,
      rawValue: r.raw_value as string,
      parsedValue: (r.parsed_value as number) ?? null,
      status: r.status as ImportRow["status"],
      note: (r.note as string) ?? undefined,
    }));
  }

  async commitImport(
    importId: string,
    period: Omit<Period, "id"> & { id?: string },
    metrics: RawAgentMetrics[],
    gate: RawGateMetrics
  ): Promise<Period> {
    const periodId = period.id ?? crypto.randomUUID();

    const { error: periodError } = await this.client.from("periods").upsert({
      id: periodId,
      label: period.label,
      type: period.type,
      start_date: period.startDate,
      end_date: period.endDate,
      generated_at: period.generatedAt,
    });
    if (periodError) throw periodError;

    const { error: metricsError } = await this.client.from("performance_entries").upsert(
      metrics.map((m) => ({
        agent_id: m.agentId,
        period_id: periodId,
        total_chat_conversations: m.totalChatConversations,
        avg_first_response_time_sec: m.avgFirstResponseTimeSec,
        avg_response_time_sec: m.avgResponseTimeSec,
        email_aht_sec: m.emailAHTSec,
        app_aht_sec: m.appAHTSec,
        total_chats: m.totalChats,
        csat_count: m.csatCount,
        dsat_count: m.dsatCount,
        qa_audit_pct: m.qaAuditPct,
      })),
      { onConflict: "agent_id,period_id" }
    );
    if (metricsError) throw metricsError;

    const { error: gateError } = await this.client.from("gate_metrics").upsert(
      {
        period_id: periodId,
        client_avg_wait_time_min: gate.clientAvgWaitTimeMin,
        team_processing_time_min: gate.teamProcessingTimeMin,
        chat_team_avg_response_sec: gate.chatTeamAvgResponseSec,
        team_ticket_aht_min: gate.teamTicketAHTMin,
      },
      { onConflict: "period_id" }
    );
    if (gateError) throw gateError;

    await this.client
      .from("imports")
      .update({ status: "committed", committed_at: new Date().toISOString(), period_label: period.label })
      .eq("id", importId);

    return { ...period, id: periodId };
  }
}

function mapPerformanceRow(row: Record<string, unknown>): RawAgentMetrics {
  return {
    agentId: row.agent_id as string,
    periodId: row.period_id as string,
    totalChatConversations: (row.total_chat_conversations as number) ?? null,
    avgFirstResponseTimeSec: (row.avg_first_response_time_sec as number) ?? null,
    avgResponseTimeSec: (row.avg_response_time_sec as number) ?? null,
    emailAHTSec: (row.email_aht_sec as number) ?? null,
    appAHTSec: (row.app_aht_sec as number) ?? null,
    totalChats: (row.total_chats as number) ?? null,
    csatCount: (row.csat_count as number) ?? null,
    dsatCount: (row.dsat_count as number) ?? null,
    qaAuditPct: (row.qa_audit_pct as number) ?? null,
  };
}

function mapGateRow(row: Record<string, unknown>): RawGateMetrics {
  return {
    periodId: row.period_id as string,
    clientAvgWaitTimeMin: (row.client_avg_wait_time_min as number) ?? null,
    teamProcessingTimeMin: (row.team_processing_time_min as number) ?? null,
    chatTeamAvgResponseSec: (row.chat_team_avg_response_sec as number) ?? null,
    teamTicketAHTMin: (row.team_ticket_aht_min as number) ?? null,
  };
}
