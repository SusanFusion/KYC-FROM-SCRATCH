// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhp(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

/**
 * Today's date as "YYYY-MM-DD" in the BROWSER'S OWN local timezone — for
 * client components deciding "is the most recent period today's period"
 * (the Data Import / Manual Entry period-selector default).
 *
 * Deliberately NOT `new Date().toISOString().slice(0, 10)`: toISOString()
 * is always UTC, and the team is in Manila (UTC+8), so for roughly the
 * first 8 hours of every local day (midnight–8am Manila) that UTC-based
 * "today" is still yesterday's date. That mismatch made the period
 * selector fail to recognize a brand-new day as new — it compared the
 * most recent existing period's date against the wrong "today" and
 * defaulted to merging into that (now previous-day) period instead of
 * offering "+ Start a new period", silently folding a new day's numbers
 * into the prior day's period. getDate()/getMonth()/getFullYear() read
 * the browser's local clock, so this always matches the calendar day the
 * person doing the import is actually looking at.
 */
export function getLocalTodayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Turns a caught value into a readable string for API error responses.
 * Real `Error`s have `.message`, but the Supabase/PostgREST client throws
 * plain objects shaped like `{ message, details, hint, code }` — those
 * aren't `instanceof Error`, so `String(err)` on them collapses to the
 * useless "[object Object]" instead of the actual database error (e.g. a
 * row-level-security policy violation). This pulls out whatever's
 * actually useful from either shape.
 */
export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const parts = [e.message, e.details, e.hint, e.code].filter(
      (v): v is string => typeof v === "string" && v.length > 0
    );
    if (parts.length > 0) return parts.join(" — ");
    try {
      return JSON.stringify(err);
    } catch {
      // fall through to the generic String() below
    }
  }
  return String(err);
}
