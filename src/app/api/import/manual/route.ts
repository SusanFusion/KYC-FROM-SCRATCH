import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data/repository";
import { commitImportRows } from "@/lib/data/commitImportRows";
import type { ImportRow } from "@/types/domain";
import type { RawGateMetrics } from "@/lib/scoring/types";

export const runtime = "nodejs";

interface ManualEntryPayload {
  agentId: string;
  metricKey: string;
  value: number;
}

interface ManualImportBody {
  periodLabel?: string | null;
  /** YYYY-MM-DD, from a plain <input type="date"> — no PDF-date-format guessing needed here. */
  generatedDate: string;
  gate?: Partial<RawGateMetrics>;
  entries: ManualEntryPayload[];
}

// Must match RawAgentMetrics' own fields exactly (see lib/scoring/types.ts) —
// this is the same shape PDF-derived rows populate, so manual entries flow
// through the identical scoring/dashboard pipeline.
const VALID_METRIC_KEYS = new Set([
  "totalChatConversations",
  "avgFirstResponseTimeSec",
  "avgResponseTimeSec",
  "emailAHTSec",
  "appAHTSec",
  "totalChats",
  "csatCount",
  "dsatCount",
  "qaAuditPct",
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ManualImportBody;
    if (!body.generatedDate || !Array.isArray(body.entries)) {
      return NextResponse.json({ error: "Missing a date for this period, or no values were entered." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.generatedDate)) {
      return NextResponse.json({ error: "Date must be in YYYY-MM-DD format." }, { status: 400 });
    }

    const numericEntries = body.entries.filter(
      (e) => VALID_METRIC_KEYS.has(e.metricKey) && typeof e.value === "number" && Number.isFinite(e.value)
    );

    const repo = await getRepository();
    const agents = await repo.getAgents();
    const agentIds = new Set(agents.map((a) => a.id));
    const validEntries = numericEntries.filter((e) => agentIds.has(e.agentId));

    const gateHasValue = body.gate ? Object.values(body.gate).some((v) => typeof v === "number" && Number.isFinite(v)) : false;

    // Gate-only submissions (e.g. just the two Business Gate fields the team
    // has this week, no per-agent data at all) are valid — only reject if
    // NEITHER kind of value was entered anywhere on the form.
    if (validEntries.length === 0 && !gateHasValue) {
      return NextResponse.json({ error: "Enter at least one value before saving." }, { status: 422 });
    }

    const rowsInput: Omit<ImportRow, "id" | "importId">[] = validEntries.map((e) => {
      const agent = agents.find((a) => a.id === e.agentId)!;
      return {
        agentNameRaw: agent.name,
        matchedAgentId: agent.id,
        metricKey: e.metricKey,
        rawValue: String(e.value),
        parsedValue: e.value,
        status: "extracted" as const,
      };
    });

    const { record, rows } = await repo.createImport(
      {
        fileName: "Manual entry",
        uploadedAt: new Date().toISOString(),
        periodLabel: body.periodLabel ?? null,
        status: "pending_review",
        rowCount: rowsInput.length,
      },
      rowsInput
    );

    const result = await commitImportRows({
      importId: record.id,
      rows,
      periodLabel: body.periodLabel ?? null,
      endDateIso: body.generatedDate,
      gate: body.gate,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({ period: result.period, agentsUpdated: result.agentsUpdated, importId: record.id });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error while saving manual entry.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
