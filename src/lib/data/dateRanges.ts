// Pure date-range helpers for the weekly (Sunday–Saturday, per the KYC
// team's own convention — Sunday is day 1, Saturday is the last day of the
// range) and month-to-date views. Every date in this app is a plain
// "YYYY-MM-DD" string with no time component, so every calculation here
// goes through Date.UTC/getUTC* exclusively — never the local-timezone
// Date methods — so a week or month boundary can never silently drift by a
// day depending on which timezone the server happens to run in.

export interface DateRange {
  start: string; // YYYY-MM-DD, inclusive
  end: string; // YYYY-MM-DD, inclusive
}

function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

function toUtcDate(iso: string): Date {
  const { y, m, d } = parseIso(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = toUtcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** The Sunday (day 1 of the week, per spec) of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const dow = toUtcDate(iso).getUTCDay(); // 0 = Sunday .. 6 = Saturday
  return addDays(iso, -dow);
}

/** The Sunday–Saturday week containing `iso`. */
export function weekRange(iso: string): DateRange {
  const start = startOfWeek(iso);
  return { start, end: addDays(start, 6) };
}

/** The week `deltaWeeks` away from the week starting `start` (negative = earlier). */
export function shiftWeek(start: string, deltaWeeks: number): DateRange {
  const newStart = addDays(start, deltaWeeks * 7);
  return { start: newStart, end: addDays(newStart, 6) };
}

/** The first-of-month through last-day-of-month range containing `iso`. */
export function monthRange(iso: string): DateRange {
  const { y, m } = parseIso(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${y}-${pad(m)}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month = last day of this one
  return { start, end: `${y}-${pad(m)}-${pad(lastDay)}` };
}

/** "YYYY-MM" grouping key for a date, used to bucket daily periods by month. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

const MONTH_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** "Sep 7 – 13, 2026" (same month) or "Sep 28 – Oct 4, 2026" (crosses months). */
export function formatWeekLabel(range: DateRange): string {
  const start = toUtcDate(range.start);
  const end = toUtcDate(range.end);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  const startLabel = MONTH_DAY.format(start);
  return sameMonth ? `${startLabel} – ${end.getUTCDate()}, ${end.getUTCFullYear()}` : `${startLabel} – ${MONTH_DAY_YEAR.format(end)}`;
}

/** Short single-point label for a week, for chart x-axis ticks, e.g. "Sep 7". */
export function formatWeekShortLabel(range: DateRange): string {
  return MONTH_DAY.format(toUtcDate(range.start));
}

/** "September 2026" for a date within that month. */
export function formatMonthLabel(iso: string): string {
  return MONTH_YEAR.format(toUtcDate(iso));
}
