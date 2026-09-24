// Human-readable labels for every RawAgentMetrics / RawGateMetrics field.
// Shared so Manual Entry's tick-box selection and Import History's "which
// metrics were in this submission" display always agree on wording -- this
// is intentionally just labels (ManualEntryForm keeps its own INDIVIDUAL_FIELDS
// / GATE_FIELDS arrays for rendering, since those also carry each field's
// input "hint" and column order; this file exists for the places, like
// Import History, that only need a key -> label lookup).
export const METRIC_FIELD_LABELS: Record<string, string> = {
  totalChatConversations: "Total Chat Conversations",
  avgFirstResponseTimeSec: "Chat First Response Time",
  avgResponseTimeSec: "Chat Avg Response Time",
  emailAHTSec: "Email AHT (incl. KYB)",
  appAHTSec: "Application AHT – FD",
  totalChats: "Total Chats (CSAT denominator)",
  csatCount: "CSAT Count",
  dsatCount: "DSAT Count",
  qaAuditPct: "QA Audit",
  emailTicketCount: "Email Ticket Count (incl. KYB)",
  clientAvgWaitTimeMin: "Client Avg Wait Time",
  teamProcessingTimeMin: "Avg Team Processing Time",
  chatTeamAvgResponseSec: "Chat Team Avg Response Time",
  teamTicketAHTMin: "Team Ticket AHT",
};

export function metricFieldLabel(key: string): string {
  return METRIC_FIELD_LABELS[key] ?? key;
}
