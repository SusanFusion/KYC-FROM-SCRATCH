// Pure helpers behind the "Export PDF" button on the Raw Data change history
// (the PDF itself is drawn in app/api/raw-data/history-pdf/route.tsx). Kept
// free of React / Next imports so the filtering, text-cleaning and formatting
// rules can be tested on their own.
import { formatRawValuePrecise, rawFieldDef, type RawDataChange } from "./rawDataFields";

/** The built-in PDF fonts only cover Western (cp1252) characters. Reasons are
 *  free text, so anything outside that range (emoji, arrows, other scripts)
 *  is swapped for "?" instead of printing as garbage. Line breaks are kept. */
export function pdfSafe(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[^\n\u0020-\u007E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC]/gu, "?");
}

/** A valid IANA time zone name, or "UTC" -- the server runs in UTC, so the
 *  browser sends its own zone and the PDF shows the same times as the page. */
export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function formatStamp(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/** Same matching the on-screen list uses: agent name contains the text. */
export function filterChanges(changes: RawDataChange[], agent: string): RawDataChange[] {
  const needle = agent.trim().toLowerCase();
  if (!needle) return changes;
  return changes.filter((c) => c.agentName.toLowerCase().includes(needle));
}

export function summarizeChanges(changes: RawDataChange[]): { total: number; edits: number; deletions: number } {
  const deletions = changes.filter((c) => c.action === "delete").length;
  return { total: changes.length, edits: changes.length - deletions, deletions };
}

/** One printable line per changed field: "Chat avg response (sec): 9.77s -> 12.4s". */
export function describeFieldChanges(change: RawDataChange): string[] {
  return change.changes.map((ch) => {
    const kind = rawFieldDef(ch.field)?.kind ?? "count";
    const from = formatRawValuePrecise(kind, ch.from);
    if (change.action === "delete") return `${ch.label}: ${from} (removed)`;
    return `${ch.label}: ${from} -> ${formatRawValuePrecise(kind, ch.to)}`;
  });
}
