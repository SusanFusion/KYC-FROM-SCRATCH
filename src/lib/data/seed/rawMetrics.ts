import { parseDurationToSeconds } from "../time";
import { CURRENT_PERIOD_ID } from "./periods";
import type { RawAgentMetrics, RawGateMetrics } from "../../scoring/types";

// Every value below is transcribed verbatim (as duration strings, exactly as
// printed) from the Daily KYC Team Performance Report, pages 2-5. Agents
// absent from a given source table are recorded as `null` for that metric —
// never invented — per notes.ts.
interface SourceRow {
  agentId: string;
  totalChatConversations: number | null;
  avgFirstResponseTime: string | null; // page 2
  avgResponseTime: string | null; // page 2
  emailAHT: string | null; // page 3
  appAHT: string | null; // page 4
  totalChats: number | null; // page 5
  csatCount: number | null; // page 5
  dsatCount: number | null; // page 5
}

const SOURCE_ROWS: SourceRow[] = [
  { agentId: "abigael-callos", totalChatConversations: 14, avgFirstResponseTime: "12s 500ms", avgResponseTime: "26s 600ms", emailAHT: "2m 9s 790ms", appAHT: "3m 52s 670ms", totalChats: 14, csatCount: 2, dsatCount: 0 },
  { agentId: "aimee-hicana", totalChatConversations: 15, avgFirstResponseTime: "12s 800ms", avgResponseTime: "36s 450ms", emailAHT: "1m 53s 620ms", appAHT: "5m 52s 870ms", totalChats: 15, csatCount: 4, dsatCount: 1 },
  { agentId: "alain-sebastian", totalChatConversations: 1, avgFirstResponseTime: "45s", avgResponseTime: "44s 630ms", emailAHT: "1m 27s 890ms", appAHT: "1m 39s 950ms", totalChats: 1, csatCount: 1, dsatCount: 0 },
  { agentId: "angeline-amamio", totalChatConversations: 3, avgFirstResponseTime: "21s 670ms", avgResponseTime: "25s 540ms", emailAHT: "2m 11s 150ms", appAHT: "3m 9s 190ms", totalChats: 3, csatCount: 0, dsatCount: 0 },
  { agentId: "earl-insierto", totalChatConversations: 13, avgFirstResponseTime: "10s 540ms", avgResponseTime: "19s 120ms", emailAHT: "56s 40ms", appAHT: "1m 37s 110ms", totalChats: 13, csatCount: 6, dsatCount: 0 },
  { agentId: "evangeline-de-ocampo", totalChatConversations: 12, avgFirstResponseTime: "8s 420ms", avgResponseTime: "9s 80ms", emailAHT: "1m 29s 970ms", appAHT: "1m 21s 560ms", totalChats: 12, csatCount: 1, dsatCount: 0 },
  { agentId: "hans-nicole-diaz", totalChatConversations: 35, avgFirstResponseTime: "8s 510ms", avgResponseTime: "11s 30ms", emailAHT: "3m 41s 410ms", appAHT: "3m 44s 40ms", totalChats: 35, csatCount: 3, dsatCount: 0 },
  { agentId: "jay-ann-oteros", totalChatConversations: 17, avgFirstResponseTime: "11s 650ms", avgResponseTime: "20s 520ms", emailAHT: "2m 33s 320ms", appAHT: "5m 390ms", totalChats: 17, csatCount: 2, dsatCount: 0 },
  { agentId: "jenieme-antong", totalChatConversations: null, avgFirstResponseTime: null, avgResponseTime: null, emailAHT: "1m 45s 760ms", appAHT: "3m 19s 510ms", totalChats: null, csatCount: null, dsatCount: null },
  { agentId: "jessamae-candongo", totalChatConversations: 15, avgFirstResponseTime: "14s 600ms", avgResponseTime: "25s 80ms", emailAHT: "1m 9s 270ms", appAHT: "2m 31s 20ms", totalChats: 15, csatCount: 3, dsatCount: 3 },
  { agentId: "katrina-carungui", totalChatConversations: 8, avgFirstResponseTime: "8s 880ms", avgResponseTime: "20s 880ms", emailAHT: "2m 18s 320ms", appAHT: "7m 14s 320ms", totalChats: 8, csatCount: 1, dsatCount: 0 },
  { agentId: "lailani-palle", totalChatConversations: 34, avgFirstResponseTime: "9s 350ms", avgResponseTime: "17s 890ms", emailAHT: "1m 37s 120ms", appAHT: "1m 57s 910ms", totalChats: 34, csatCount: 8, dsatCount: 0 },
  { agentId: "maria-patrisha-lopez", totalChatConversations: 32, avgFirstResponseTime: "6s 310ms", avgResponseTime: "4s 810ms", emailAHT: "2m 4s 710ms", appAHT: "3m 2s 510ms", totalChats: 32, csatCount: 10, dsatCount: 1 },
  { agentId: "michelle-barcelona", totalChatConversations: 12, avgFirstResponseTime: "15s 750ms", avgResponseTime: "12s 550ms", emailAHT: "1m 52s 760ms", appAHT: "2m 48s 530ms", totalChats: 12, csatCount: 0, dsatCount: 1 },
  { agentId: "patricia-marie-cruz", totalChatConversations: 26, avgFirstResponseTime: "11s 310ms", avgResponseTime: "54s 210ms", emailAHT: "20m 38s 860ms", appAHT: "10m 23s 140ms", totalChats: 26, csatCount: 3, dsatCount: 1 },
  { agentId: "yuri-bulahan", totalChatConversations: null, avgFirstResponseTime: null, avgResponseTime: null, emailAHT: "2m 12s 690ms", appAHT: "30s 270ms", totalChats: null, csatCount: null, dsatCount: null },
  { agentId: "yvonne-tang", totalChatConversations: 8, avgFirstResponseTime: "9s", avgResponseTime: "8s 110ms", emailAHT: "1m 19s 830ms", appAHT: "1m 40s 640ms", totalChats: 8, csatCount: 1, dsatCount: 0 },
];

/** QA Audit % was not present anywhere in the source report — see notes.ts "missing-qa-audit-data". */
const QA_AUDIT_PCT: Record<string, number | null> = {};

export function buildSeedRawMetrics(): RawAgentMetrics[] {
  return SOURCE_ROWS.map((row) => ({
    agentId: row.agentId,
    periodId: CURRENT_PERIOD_ID,
    totalChatConversations: row.totalChatConversations,
    avgFirstResponseTimeSec: parseDurationToSeconds(row.avgFirstResponseTime),
    avgResponseTimeSec: parseDurationToSeconds(row.avgResponseTime),
    emailAHTSec: parseDurationToSeconds(row.emailAHT),
    appAHTSec: parseDurationToSeconds(row.appAHT),
    totalChats: row.totalChats,
    csatCount: row.csatCount,
    dsatCount: row.dsatCount,
    qaAuditPct: QA_AUDIT_PCT[row.agentId] ?? null,
    // Not present in this snapshot's source pages -- never invented, per
    // this file's own rule above.
    emailTicketCount: null,
  }));
}

// Business Gate (Layer 1, team-level) figures. The Daily Report's KPI cards
// only surfaced two of the four Business Gate metrics for this snapshot
// (Chat Team Avg Response Time and Team Ticket AHT) — "KYC Applications -
// Client Avg Wait Time" and "KYC Applications – Avg Team Processing Time"
// were not present on the pages captured. Those two are left `null` and
// excluded from the gate-multiplier weighting (renormalized across the
// available metrics) rather than guessed — see notes.ts.
export function buildSeedGateMetrics(): RawGateMetrics {
  return {
    periodId: CURRENT_PERIOD_ID,
    clientAvgWaitTimeMin: null,
    teamProcessingTimeMin: null,
    chatTeamAvgResponseSec: parseDurationToSeconds("18s 320ms"),
    teamTicketAHTMin: (parseDurationToSeconds("2m 58s 200ms") ?? 0) / 60,
  };
}
