import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data/repository";
import { requireActionAccess } from "@/lib/auth/actionAccess";
import { describeError } from "@/lib/utils";
import type { RawAgentMetrics, RawGateMetrics } from "@/lib/scoring/types";

export const runtime = "nodejs";

// POST /api/import/clear-field
//
// Manual Entry (see ManualEntryForm.tsx) can only ever WRITE a value to a
// field — leaving a box untouched leaves the record alone, and there was
// never a way to explicitly say "no, this field should go back to no data
// at all". That gap is exactly why a stale QA Audit % (or any other field)
// written by something that's since been deleted from Import History can
// stay stuck forever: deleting an import record only removes its own
// audit-trail entry when another import still shares that same day (see
// /api/import/delete's own comment) — it never reverts the value that
// import wrote. This route is the deliberate, explicit "clear it" action:
// it writes a real null onto one exact agent+period+field (or one
// Business Gate field for the whole period, when agentId is omitted),
// using the same low-level commitImport() path refreshQaAuditPct.ts uses
// to do the same thing for qaAuditPct specifically — commitImportRows()
// can't be reused here because its null-write guard (`parsedValue !==
// null`) exists specifically to stop an import from ever silently erasing
// data, which is the opposite of what a deliberate clear needs to do.

const INDIVIDUAL_KEYS = new Set([
  "totalChatConversations",
  "avgFirstResponseTimeSec",
  "avgResponseTimeSec",
  "emailAHTSec",
  "appAHTSec",
  "totalChats",
  "csatCount",
  "dsatCount",
  "qaAuditPct",
  "emailTicketCount",
]);

const GATE_KEYS = new Set(["clientAvgWaitTimeMin", "teamProcessingTimeMin", "chatTeamAvgResponseSec", "teamTicketAHTMin"]);

interface ClearFieldBody {
  periodId: string;
  metricKey: string;
  /** Omit/null for a Business Gate field — those are team-level, not per-agent. */
  agentId?: string | null;
}

function blankAgentRow(agentId: string, periodId: string): RawAgentMetrics {
  return {
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
}

export async function POST(request: Request) {
  try {
    const denied = await requireActionAccess();
    if (denied) return denied;

    const body = (await request.json()) as ClearFieldBody;
    if (!body.periodId || !body.metricKey) {
      return NextResponse.json({ error: "Missing periodId or metricKey." }, { status: 400 });
    }

    const isIndividual = INDIVIDUAL_KEYS.has(body.metricKey);
    const isGate = GATE_KEYS.has(body.metricKey);
    if (!isIndividual && !isGate) {
      return NextResponse.json({ error: "Unknown metric." }, { status: 400 });
    }
    if (isIndividual && !body.agentId) {
      return NextResponse.json({ error: "Missing agentId for an individual metric." }, { status: 400 });
    }

    const repo = await getRepository();
    const [periods, existingMetrics, existingGate] = await Promise.all([
      repo.getPeriods(),
      repo.getRawMetrics(body.periodId),
      repo.getGateMetrics(body.periodId),
    ]);
    const period = periods.find((p) => p.id === body.periodId);
    if (!period) {
      return NextResponse.json({ error: "That period no longer exists." }, { status: 404 });
    }

    let metrics = existingMetrics;
    let gate: RawGateMetrics = existingGate ?? {
      periodId: body.periodId,
      clientAvgWaitTimeMin: null,
      teamProcessingTimeMin: null,
      chatTeamAvgResponseSec: null,
      teamTicketAHTMin: null,
    };
    let agentNameRaw = "Business Gate (team-level)";

    if (isGate) {
      const nextGate: RawGateMetrics = { ...gate };
      (nextGate as unknown as Record<string, number | null>)[body.metricKey] = null;
      gate = nextGate;
    } else {
      const agentId = body.agentId as string;
      const agents = await repo.getAgents();
      agentNameRaw = agents.find((a) => a.id === agentId)?.name ?? agentId;

      const existingRow = metrics.find((m) => m.agentId === agentId);
      const nextRow: RawAgentMetrics = existingRow ? { ...existingRow } : blankAgentRow(agentId, body.periodId);
      (nextRow as unknown as Record<string, number | null>)[body.metricKey] = null;
      metrics = existingRow ? metrics.map((m) => (m.agentId === agentId ? nextRow : m)) : [...metrics, nextRow];
    }

    const { record } = await repo.createImport(
      {
        fileName: "Manual clear",
        uploadedAt: new Date().toISOString(),
        periodLabel: null,
        status: "pending_review",
        rowCount: 1,
      },
      [
        {
          agentNameRaw,
          matchedAgentId: isIndividual ? (body.agentId as string) : null,
          metricKey: body.metricKey,
          rawValue: "cleared",
          parsedValue: null,
          status: "extracted",
        },
      ]
    );

    await repo.commitImport(record.id, period, metrics, gate);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error while clearing this field.", detail: describeError(err) },
      { status: 500 }
    );
  }
}
