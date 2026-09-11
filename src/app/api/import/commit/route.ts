import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data/repository";
import type { RawAgentMetrics, RawGateMetrics } from "@/lib/scoring/types";
import type { ImportRow, Period, PeriodType } from "@/types/domain";

export const runtime = "nodejs";

interface CommitBody {
  importId: string;
  rows: ImportRow[]; // the user-reviewed/edited rows
  periodLabel?: string | null;
  generatedDateGuess?: string | null;
  gate?: Partial<RawGateMetrics>;
}

function parseDdMmYyyy(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CommitBody;
    if (!body.importId || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: "Missing importId or rows." }, { status: 400 });
    }

    const validRows = body.rows.filter((r) => r.status !== "failed" && r.matchedAgentId);
    if (validRows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows to commit. Resolve the flagged rows first (unmatched agents or failed parses)." },
        { status: 422 }
      );
    }

    const endDate = parseDdMmYyyy(body.generatedDateGuess) ?? new Date().toISOString().slice(0, 10);
    const isMonth = /month/i.test(body.periodLabel ?? "");
    const startDate = isMonth ? `${endDate.slice(0, 7)}-01` : endDate;
    const periodType: PeriodType = isMonth ? "month-to-date" : "custom";
    const periodId = `import-${endDate}-${body.importId.slice(-6)}`;

    const period: Omit<Period, "id"> & { id?: string } = {
      id: periodId,
      label: body.periodLabel ? `${body.periodLabel} (imported ${endDate})` : `Imported period (${endDate})`,
      type: periodType,
      startDate,
      endDate,
      generatedAt: endDate,
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
      clientAvgWaitTimeMin: body.gate?.clientAvgWaitTimeMin ?? null,
      teamProcessingTimeMin: body.gate?.teamProcessingTimeMin ?? null,
      chatTeamAvgResponseSec: body.gate?.chatTeamAvgResponseSec ?? null,
      teamTicketAHTMin: body.gate?.teamTicketAHTMin ?? null,
    };

    const repo = await getRepository();
    const committedPeriod = await repo.commitImport(body.importId, period, [...byAgent.values()], gate);

    return NextResponse.json({ period: committedPeriod, agentsUpdated: byAgent.size });
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error while committing the import.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
