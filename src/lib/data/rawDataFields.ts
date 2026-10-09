// Shared (client + server safe -- no server-only imports) description of the
// per-agent KPI fields the Raw Data page shows / edits, plus the shape of a
// change-history entry. Kept in one place so the table, the edit pop-up, the
// server-side validation and the history list can never disagree on what a
// field is called, what unit it's in, or how it should be displayed.
import type { RawAgentMetrics, RawIndividualMetricKey } from "@/lib/scoring/types";
import { formatSeconds } from "./time";

export type RawFieldKind = "count" | "seconds" | "percent";

export interface RawFieldDef {
  key: RawIndividualMetricKey;
  /** Label used in the edit pop-up and the change history. */
  label: string;
  /** Short column header for the table. */
  short: string;
  kind: RawFieldKind;
}

export const RAW_FIELDS: RawFieldDef[] = [
  { key: "totalChatConversations", label: "Total chat conversations", short: "Chats", kind: "count" },
  { key: "avgFirstResponseTimeSec", label: "Chat first response (sec)", short: "Chat First", kind: "seconds" },
  { key: "avgResponseTimeSec", label: "Chat avg response (sec)", short: "Chat Avg", kind: "seconds" },
  { key: "emailAHTSec", label: "Email AHT incl. KYB (sec)", short: "Email AHT", kind: "seconds" },
  { key: "appAHTSec", label: "Application AHT (sec)", short: "App AHT", kind: "seconds" },
  { key: "emailTicketCount", label: "Email tickets (incl. KYB)", short: "Tickets", kind: "count" },
  { key: "totalChats", label: "Total chats (CSAT base)", short: "Total Chats", kind: "count" },
  { key: "csatCount", label: "CSAT count", short: "CSAT", kind: "count" },
  { key: "dsatCount", label: "DSAT count", short: "DSAT", kind: "count" },
  { key: "qaAuditPct", label: "QA audit (%)", short: "QA %", kind: "percent" },
];

export type RawValues = Record<RawIndividualMetricKey, number | null>;

export function emptyRawValues(): RawValues {
  const values = {} as RawValues;
  for (const f of RAW_FIELDS) values[f.key] = null;
  return values;
}

/** Collapses several rows for the SAME agent on the SAME day (each import
 *  mints its own daily period, so a day imported in more than one go has
 *  more than one row) into the single set of values the dashboards actually
 *  use: per field, the most recent row that has a value wins. `rows` must be
 *  ordered oldest import first -- the same rule collapseDayRaw() in
 *  query.ts applies, so what this page shows is what every score is built
 *  from. */
export function mergeRawValues(rows: RawAgentMetrics[]): RawValues {
  const merged = emptyRawValues();
  for (const row of rows) {
    for (const f of RAW_FIELDS) {
      const value = row[f.key];
      if (value !== null && value !== undefined) merged[f.key] = value;
    }
  }
  return merged;
}

export function rawValuesEqual(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < 1e-9;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Compact display for the table ("2m 7s", "23", "85%"). */
export function formatRawValue(kind: RawFieldKind, value: number | null): string {
  if (value === null) return "—";
  if (kind === "seconds") return formatSeconds(value);
  if (kind === "percent") return `${round2(value)}%`;
  return String(round2(value));
}

/** Exact display for the change history ("9.77s", not a rounded "9.8s"). */
export function formatRawValuePrecise(kind: RawFieldKind, value: number | null): string {
  if (value === null) return "no data";
  if (kind === "seconds") return `${round2(value)}s`;
  if (kind === "percent") return `${round2(value)}%`;
  return String(round2(value));
}

export function rawFieldDef(key: string): RawFieldDef | undefined {
  return RAW_FIELDS.find((f) => f.key === key);
}

export interface RawDataFieldChange {
  field: RawIndividualMetricKey;
  label: string;
  from: number | null;
  to: number | null;
}

/** One entry in the Raw Data change history -- written for every edit and
 *  every delete, always with the reason the person gave. */
export interface RawDataChange {
  id: string;
  createdAt: string;
  action: "edit" | "delete";
  changedBy: string;
  reason: string;
  agentId: string;
  agentName: string;
  /** The day (YYYY-MM-DD) the entry belongs to. */
  date: string;
  changes: RawDataFieldChange[];
}
