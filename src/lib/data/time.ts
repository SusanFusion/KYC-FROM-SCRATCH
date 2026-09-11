// Parses/formats the "2m 58s 200ms" style duration strings used throughout
// the source PDFs into plain seconds (as a float) for calculation, and back
// into a compact human-readable string for display.

const DURATION_PART = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|m|min|mins|s|sec|secs|ms)\b/gi;

const UNIT_TO_SECONDS: Record<string, number> = {
  h: 3600,
  hr: 3600,
  hrs: 3600,
  m: 60,
  min: 60,
  mins: 60,
  s: 1,
  sec: 1,
  secs: 1,
  ms: 0.001,
};

/**
 * Parses a duration string such as "2m 58s 200ms", "45s", "1h 2m", or a
 * plain number (already in seconds) into total seconds. Returns null for
 * empty/unparseable input rather than silently defaulting to 0, so missing
 * data can be distinguished from a genuine zero.
 */
export function parseDurationToSeconds(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;

  const trimmed = input.trim();
  if (trimmed === "") return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  let total = 0;
  let matched = false;
  for (const match of trimmed.matchAll(DURATION_PART)) {
    const value = Number(match[1]);
    const unit = match[2]!.toLowerCase();
    const multiplier = UNIT_TO_SECONDS[unit];
    if (multiplier === undefined) continue;
    total += value * multiplier;
    matched = true;
  }
  return matched ? total : null;
}

/** Formats seconds as a compact "Xm Ys" / "X.Xs" string (no milliseconds — see formatPrecise for that). */
export function formatSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) return "—";
  const abs = Math.abs(totalSeconds);
  if (abs < 60) {
    const rounded = Math.round(abs * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}s`;
  }
  return formatMinutes(totalSeconds);
}

/** Formats seconds as "Hh Mm Ss" style, dropping empty leading units. Input is a total-seconds duration. */
export function formatMinutes(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) return "—";
  const abs = Math.round(Math.abs(totalSeconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;

  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (h > 0 || m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

/** Formats a minutes value (as used by the Business Gate / individual AHT thresholds) for display. */
export function formatMinutesValue(minutes: number): string {
  return formatMinutes(minutes * 60);
}
