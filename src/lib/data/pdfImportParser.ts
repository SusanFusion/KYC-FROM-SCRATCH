// Parses the "Daily/Monthly KYC Team Performance Report" PDF layout into
// preview rows for the Data Import workflow.
//
// Design note: this does NOT parse raw PDF text linearly (fragile — table
// columns routinely get interleaved in PDF text-extraction order). Instead
// it takes each text item's (x, y) position — as returned by pdfjs-dist's
// getTextContent() — and reconstructs rows/columns from that geometry. This
// was built and verified against the actual structure of the report PDF
// supplied for this project (see scripts/verify-pdf-import.ts), not guessed.
import { parseDurationToSeconds } from "./time";
import type { Agent } from "@/types/domain";
import type { ImportRow } from "@/types/domain";

export interface PageTextItem {
  str: string;
  x: number;
  y: number;
}

export type TableType = "chatMetrics" | "emailAHT" | "appAHT" | "csatDsat" | "qaAudit" | "unknown";

const TABLE_MATCHERS: { type: TableType; test: (pageText: string) => boolean }[] = [
  {
    type: "chatMetrics",
    test: (t) => /total chat conversations/i.test(t) && /average first response time/i.test(t),
  },
  {
    type: "emailAHT",
    test: (t) => /email ave handling time/i.test(t) || (/ticket aht/i.test(t) && /kyb/i.test(t) && !/csat/i.test(t)),
  },
  { type: "appAHT", test: (t) => /application ave handling time/i.test(t) },
  { type: "csatDsat", test: (t) => /csat/i.test(t) && /dsat/i.test(t) },
  { type: "qaAudit", test: (t) => /qa audit/i.test(t) },
];

const HEADER_FIRST_CELLS = new Set(["agent", "assigned agent name"]);
const IGNORE_ROW_PATTERNS = [/^date range/i, /^generated date/i, /^\+\s*\d+\s*additional/i, /^\s*$/];

const GATE_CARD_DEFS: { key: string; test: (t: string) => boolean }[] = [
  { key: "chatTeamAvgResponse", test: (t) => /chat.*team.*avg.*response.*time/i.test(t) },
  { key: "teamTicketAHT", test: (t) => /team ticket (resolution|aht)/i.test(t) },
  { key: "clientAvgWaitTime", test: (t) => /client avg wait time/i.test(t) },
  { key: "teamProcessingTime", test: (t) => /avg team processing time/i.test(t) },
];

const DURATION_LIKE = /^\d+(\.\d+)?\s*(h|hr|hrs|m|min|mins|s|sec|secs|ms)\b/i;

function groupIntoRows(items: PageTextItem[], tolerance = 2.5): PageTextItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows: PageTextItem[][] = [];
  for (const item of sorted) {
    const current = rows[rows.length - 1];
    if (current && Math.abs(current[0]!.y - item.y) <= tolerance) current.push(item);
    else rows.push([item]);
  }
  return rows.map((row) => row.sort((a, b) => a.x - b.x));
}

function clusterByX(items: PageTextItem[], gapThreshold = 120): PageTextItem[][] {
  const distinctXs = [...new Set(items.map((i) => i.x))].sort((a, b) => a - b);
  const clusters: number[][] = [];
  let current: number[] = [];
  for (const x of distinctXs) {
    if (current.length && x - current[current.length - 1]! > gapThreshold) {
      clusters.push(current);
      current = [];
    }
    current.push(x);
  }
  if (current.length) clusters.push(current);
  return clusters.map((xs) => items.filter((i) => xs.includes(i.x)));
}

function matchAgent(nameRaw: string, agents: Agent[]): Agent | null {
  const normalized = nameRaw.trim().toLowerCase().replace(/\s+/g, " ");
  return agents.find((a) => a.name.trim().toLowerCase().replace(/\s+/g, " ") === normalized) ?? null;
}

export interface ParsedGateSnapshot {
  clientAvgWaitTimeMin: number | null;
  teamProcessingTimeMin: number | null;
  chatTeamAvgResponseSec: number | null;
  teamTicketAHTMin: number | null;
}

export interface PdfParseResult {
  rows: Omit<ImportRow, "id" | "importId">[];
  gate: ParsedGateSnapshot;
  gateFieldsFound: string[];
  periodLabelGuess: string | null;
  generatedDateGuess: string | null;
  tablesDetected: TableType[];
  warnings: string[];
}

export function parseKycReportPages(pages: PageTextItem[][], agents: Agent[]): PdfParseResult {
  const rows: Omit<ImportRow, "id" | "importId">[] = [];
  const warnings: string[] = [];
  const tablesDetected = new Set<TableType>();
  const gate: ParsedGateSnapshot = {
    clientAvgWaitTimeMin: null,
    teamProcessingTimeMin: null,
    chatTeamAvgResponseSec: null,
    teamTicketAHTMin: null,
  };
  const gateFieldsFound: string[] = [];
  let periodLabelGuess: string | null = null;
  let generatedDateGuess: string | null = null;

  for (const pageItems of pages) {
    const nonEmpty = pageItems.filter((i) => i.str.trim() !== "");
    if (nonEmpty.length === 0) continue;

    const pageText = nonEmpty.map((i) => i.str).join(" ");

    // When multiple PDFs are merged into one import (see /api/import/parse),
    // each one's pages flow through here in sequence. Keep the FIRST guess
    // found rather than letting a later file silently overwrite it, and
    // flag it instead if a later file disagrees — that's a real signal the
    // files may not all be for the same reporting period.
    const genDateMatch = pageText.match(/Generated Date:\s*([\d-]+)/i);
    if (genDateMatch) {
      const found = genDateMatch[1] ?? null;
      if (generatedDateGuess === null) generatedDateGuess = found;
      else if (found && found !== generatedDateGuess) {
        warnings.push(`One of the uploaded PDFs has a different Generated Date ("${found}") than the first ("${generatedDateGuess}") — confirm they're all for the same period.`);
      }
    }
    const rangeMatch = pageText.match(/Date Range\s*:\s*([A-Za-z0-9 ]+?)(?=\s{2}|$)/i);
    if (rangeMatch) {
      const found = rangeMatch[1]?.trim() ?? null;
      if (periodLabelGuess === null) periodLabelGuess = found;
      else if (found && found !== periodLabelGuess) {
        warnings.push(`One of the uploaded PDFs has a different Date Range ("${found}") than the first ("${periodLabelGuess}") — confirm they're all for the same period.`);
      }
    }

    const tableType = TABLE_MATCHERS.find((m) => m.test(pageText))?.type;
    const allRows = groupIntoRows(nonEmpty);

    // Header row y (used to separate "card" content above the table from
    // the table itself, and to find data rows below the header).
    // Only the row's FIRST cell identifies a real table header ("Agent" /
    // "Assigned Agent name") — checking for "Average Time tracked" anywhere
    // in the row was ambiguous: that exact phrase also appears as a KPI
    // card caption above the table on some pages, which was matching here
    // first and misidentifying the card zone as the table body (caught by
    // scripts/verify-pdf-import.ts against the real PDF).
    const headerRowIdx = allRows.findIndex((row) => {
      const first = row[0]?.str.trim().toLowerCase() ?? "";
      return HEADER_FIRST_CELLS.has(first);
    });

    if (tableType) {
      tablesDetected.add(tableType);
      const dataRows = headerRowIdx >= 0 ? allRows.slice(headerRowIdx + 1) : allRows;

      for (const row of dataRows) {
        const cells = row.map((c) => c.str.trim()).filter(Boolean);
        if (cells.length === 0) continue;
        const firstCell = cells[0]!.toLowerCase();
        if (HEADER_FIRST_CELLS.has(firstCell)) continue;
        if (IGNORE_ROW_PATTERNS.some((p) => p.test(cells[0]!))) continue;
        // Section-title rows contain a "%)" weight marker or "Target" — not agent data.
        if (/%\)/.test(cells.join(" ")) || /\btarget\b/i.test(cells.join(" "))) continue;

        const agentNameRaw = cells[0]!;
        const agent = matchAgent(agentNameRaw, agents);
        const values = cells.slice(1);

        pushRowsForTable(tableType, agentNameRaw, agent, values, rows, warnings);
      }
    } else if (headerRowIdx === -1 && !/generated date|date range|additional/i.test(pageText)) {
      // A page with tabular-looking data we don't recognize — surface it
      // for manual review rather than silently dropping it.
      const sample = allRows
        .slice(0, 3)
        .map((r) => r.map((c) => c.str).join(" "))
        .join(" / ");
      if (sample.trim()) {
        warnings.push(`Unrecognized table layout on a page (sample: "${sample.slice(0, 120)}")`);
      }
    }

    // Business Gate ("card") values sit above the table header on the page.
    if (headerRowIdx >= 0) {
      const headerY = allRows[headerRowIdx]![0]!.y;
      const cardItems = nonEmpty.filter((i) => i.y > headerY + 15);
      if (cardItems.length > 0) {
        for (const cluster of clusterByX(cardItems)) {
          const clusterText = cluster.map((c) => c.str).join(" ");
          const def = GATE_CARD_DEFS.find((d) => d.test(clusterText));
          const valueItem = cluster.find((c) => DURATION_LIKE.test(c.str.trim()));
          if (def && valueItem) {
            const seconds = parseDurationToSeconds(valueItem.str.trim());
            if (seconds !== null) {
              gateFieldsFound.push(def.key);
              if (def.key === "chatTeamAvgResponse") gate.chatTeamAvgResponseSec = seconds;
              if (def.key === "teamTicketAHT") gate.teamTicketAHTMin = seconds / 60;
              if (def.key === "clientAvgWaitTime") gate.clientAvgWaitTimeMin = seconds / 60;
              if (def.key === "teamProcessingTime") gate.teamProcessingTimeMin = seconds / 60;
            }
          }
        }
      }
    }
  }

  return {
    rows,
    gate,
    gateFieldsFound,
    periodLabelGuess,
    generatedDateGuess,
    tablesDetected: [...tablesDetected],
    warnings,
  };
}

function pushRowsForTable(
  tableType: TableType,
  agentNameRaw: string,
  agent: Agent | null,
  values: string[],
  out: Omit<ImportRow, "id" | "importId">[],
  warnings: string[]
) {
  function addRow(metricKey: string, rawValue: string | undefined, isDuration: boolean) {
    if (rawValue === undefined) {
      out.push({
        agentNameRaw,
        matchedAgentId: agent?.id ?? null,
        metricKey,
        rawValue: "",
        parsedValue: null,
        status: "failed",
        note: "Expected value missing for this column",
      });
      return;
    }
    const parsedValue = isDuration ? parseDurationToSeconds(rawValue) : Number(rawValue.replace(/[^\d.]/g, ""));
    const status: ImportRow["status"] = !agent
      ? "needs_review"
      : parsedValue === null || Number.isNaN(parsedValue)
        ? "failed"
        : "extracted";
    out.push({
      agentNameRaw,
      matchedAgentId: agent?.id ?? null,
      metricKey,
      rawValue,
      parsedValue: parsedValue === null || Number.isNaN(parsedValue) ? null : parsedValue,
      status,
      note: !agent ? "Agent name not found in roster — confirm match manually" : undefined,
    });
  }

  switch (tableType) {
    case "chatMetrics":
      addRow("totalChatConversations", values[0], false);
      addRow("avgFirstResponseTimeSec", values[1], true);
      addRow("avgResponseTimeSec", values[2], true);
      break;
    case "emailAHT":
      addRow("emailAHTSec", values[0], true);
      break;
    case "appAHT":
      addRow("appAHTSec", values[0], true);
      break;
    case "csatDsat":
      addRow("totalChats", values[0], false);
      addRow("csatCount", values[1], false);
      addRow("dsatCount", values[2], false);
      break;
    case "qaAudit":
      addRow("qaAuditPct", values[0]?.replace("%", ""), false);
      break;
    default:
      warnings.push(`No column mapping for table type "${tableType}" (agent: ${agentNameRaw})`);
  }
}
