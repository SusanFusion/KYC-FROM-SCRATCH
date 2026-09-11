import type { Direction, Grade, GradeBand, GateBand, GateTier } from "./types";

/**
 * Resolves which band a value falls into.
 *
 * Boundary convention (applied consistently across every metric so a value
 * sitting exactly on a threshold always resolves the same way):
 *  - lower-is-better metrics: the BETTER band's upper bound is inclusive
 *    (e.g. "≤ 20 minutes" → exactly 20 is Exceptional), and each worse band
 *    is (prevMax, thisMax].
 *  - higher-is-better metrics: the BETTER band's lower bound is inclusive
 *    (e.g. "≥ 95%" → exactly 95 is Exceptional), and each worse band is
 *    [thisMin, prevMin).
 */
function resolveBand<T extends { min: number | null; max: number | null }>(
  value: number,
  bands: T[],
  direction: Direction
): T | null {
  if (direction === "lower-is-better") {
    for (const band of bands) {
      const aboveMin = band.min === null || value > band.min;
      const withinMax = band.max === null || value <= band.max;
      if (aboveMin && withinMax) return band;
    }
  } else {
    for (const band of bands) {
      const aboveMin = band.min === null || value >= band.min;
      const withinMax = band.max === null || value < band.max;
      if (aboveMin && withinMax) return band;
    }
  }
  return null;
}

export function gradeIndividualMetric(
  value: number,
  bands: GradeBand[],
  direction: Direction
): GradeBand | null {
  return resolveBand(value, bands, direction);
}

export function gradeGateMetric(
  value: number,
  bands: GateBand[],
  direction: Direction
): GateBand | null {
  return resolveBand(value, bands, direction);
}

export const GRADE_LABELS: Record<Grade, string> = {
  3: "Exceptional",
  2: "On Target",
  1: "Below Target",
  0: "Failing",
};

export const GATE_TIER_ORDER: GateTier[] = ["Red", "Amber", "Green", "Exceptional"];
