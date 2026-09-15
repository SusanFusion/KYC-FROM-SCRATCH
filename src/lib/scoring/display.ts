// Presentation-adjacent helpers that stay dependency-free (no React/Next
// imports) so they can sit next to the rest of the scoring engine and be
// unit-tested the same way. UI components format *values*; this module
// formats *ranges* (for the scoring-scale table) and *margins* (for the
// "how much room before this tips into Amber" buffer captions).

import { formatMinutes, formatSeconds } from "../data/time";
import { GATE_METRICS, INDIVIDUAL_METRICS } from "./thresholds";
import type { Direction, GateBand, GateMetricKey, GradeBand, IndividualMetricKey } from "./types";

export type MetricUnit = "minutes" | "seconds" | "percent";

/** Formats a bare magnitude (not a point-in-time value) in the metric's unit,
 *  for buffer/delta captions, e.g. "5.2s under", "2.3 pts above". */
export function formatMagnitude(unit: MetricUnit, value: number): string {
  const abs = Math.abs(value);
  if (unit === "minutes") return formatMinutes(abs * 60);
  if (unit === "seconds") return formatSeconds(abs);
  const rounded = Math.round(abs * 10) / 10;
  return `${rounded} pt${rounded === 1 ? "" : "s"}`;
}

/**
 * Snaps a raw value to the same granularity its own formatted display
 * string uses, so a delta computed from two of these (e.g. for a
 * period-over-period comparison) can never disagree with simple mental math
 * done on the displayed "was X → now Y" strings (see notes.ts
 * "trends-delta-precision"). Minutes-unit metrics are stored as fractional
 * minutes but *displayed* down to the whole second (formatMinutes rounds
 * there) — snapping to 1 decimal minute first would be a 6-second bucket,
 * far coarser than the display, so this rounds to the nearest whole second
 * instead and converts back to minutes. Seconds-unit values follow
 * formatSeconds' own precision (0.1s under a minute, whole seconds at or
 * above); percent already matches its own 1-decimal display.
 */
export function roundToDisplayPrecision(unit: MetricUnit, value: number): number {
  if (unit === "minutes") return Math.round(value * 60) / 60;
  if (unit === "seconds") return Math.abs(value) < 60 ? Math.round(value * 10) / 10 : Math.round(value);
  return Math.round(value * 10) / 10;
}

/** Formats one band's range for the scoring-scale table, e.g. "≤ 19 sec",
 *  "20 – 30 sec", "> 45 sec", "≥ 95%". */
export function formatBandRange(
  band: { min: number | null; max: number | null },
  unit: MetricUnit,
  direction: Direction
): string {
  const suffix = unit === "minutes" ? " min" : unit === "seconds" ? " sec" : "%";
  const n = (v: number) => (unit === "percent" ? `${v}` : `${v}`);
  if (direction === "lower-is-better") {
    if (band.min === null && band.max !== null) return `≤ ${n(band.max)}${suffix}`;
    if (band.max === null && band.min !== null) return `> ${n(band.min)}${suffix}`;
    if (band.min !== null && band.max !== null) return `> ${n(band.min)} – ${n(band.max)}${suffix}`;
    return "—";
  }
  if (band.min === null && band.max !== null) return `< ${n(band.max)}${suffix}`;
  if (band.max === null && band.min !== null) return `≥ ${n(band.min)}${suffix}`;
  if (band.min !== null && band.max !== null) return `${n(band.min)} – < ${n(band.max)}${suffix}`;
  return "—";
}

export interface BufferInfo {
  /** e.g. "5.2s under" */
  label: string;
  /** true = safe margin before the "needs attention" tier; false = already past it. */
  good: boolean;
}

/**
 * Computes how far a value sits from the boundary between the "safe" band
 * (Green / On Target) and the "needs attention" band (Amber / Below Target)
 * for that metric — i.e. how much room is left before this metric would tip
 * into the amber zone — regardless of which band the value currently falls
 * in. `safeBand` is that metric's Green/On Target band definition.
 */
export function computeBuffer(
  actual: number,
  safeBand: { min: number | null; max: number | null } | undefined,
  unit: MetricUnit,
  direction: Direction
): BufferInfo | null {
  if (!safeBand) return null;
  if (direction === "lower-is-better") {
    if (safeBand.max === null) return null;
    const diff = safeBand.max - actual;
    return { label: `${formatMagnitude(unit, diff)} ${diff >= 0 ? "under" : "over"}`, good: diff >= 0 };
  }
  if (safeBand.min === null) return null;
  const diff = actual - safeBand.min;
  return { label: `${formatMagnitude(unit, diff)} ${diff >= 0 ? "above" : "below"}`, good: diff >= 0 };
}

export type ScaleTone = "primary" | "success" | "warning" | "danger";

export interface ScaleColumnDef {
  columnLabel: string; // "Exceptional" / "Green" / "Amber" / "Red" (or the individual-metric equivalents)
  tone: ScaleTone;
}

export interface ScaleRow {
  key: GateMetricKey | IndividualMetricKey;
  name: string;
  weight: number;
  cells: string[]; // aligned to `columns`
}

const GATE_TONE: Record<string, ScaleTone> = { Exceptional: "primary", Green: "success", Amber: "warning", Red: "danger" };
const GRADE_TONE: Record<string, ScaleTone> = {
  Exceptional: "primary",
  "On Target": "success",
  "Below Target": "warning",
  Failing: "danger",
};

/** Builds the Business Gate (Layer 1) scoring-scale table: one row per
 *  team-level metric, columns Exceptional/Green/Amber/Red. */
export function buildGateScaleTable(): { columns: ScaleColumnDef[]; rows: ScaleRow[] } {
  const columns = GATE_METRICS[0]!.bands.map((b) => ({ columnLabel: b.tier, tone: GATE_TONE[b.tier] ?? "primary" }));
  const rows = GATE_METRICS.map((def) => ({
    key: def.key,
    name: def.name,
    weight: def.weight,
    cells: def.bands.map((b: GateBand) => formatBandRange(b, def.unit, def.direction)),
  }));
  return { columns, rows };
}

/** Builds the Individual Scorecard (Layer 2) scoring-scale table: one row
 *  per metric, columns Exceptional/On Target/Below Target/Failing. */
export function buildIndividualScaleTable(): { columns: ScaleColumnDef[]; rows: ScaleRow[] } {
  const columns = INDIVIDUAL_METRICS[0]!.bands.map((b) => ({ columnLabel: b.label, tone: GRADE_TONE[b.label] ?? "primary" }));
  const rows = INDIVIDUAL_METRICS.map((def) => ({
    key: def.key,
    name: def.name,
    weight: def.weight,
    cells: def.bands.map((b: GradeBand) => formatBandRange(b, def.unit, def.direction)),
  }));
  return { columns, rows };
}
