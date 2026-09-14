import { ChevronDown } from "lucide-react";
import type { BusinessGateResult } from "@/lib/scoring/types";

/**
 * "How was the Gate Multiplier calculated?" — the Business Gate equivalent
 * of CalculationDetails (used on the individual Scorecard page): a
 * zero-client-JS <details> element that walks through every metric's tier
 * score × weight, then the weighted average that produces the multiplier
 * shown in the summary bar above it.
 */
export function GateCalculationDetails({ gate }: { gate: BusinessGateResult }) {
  const available = gate.metrics.filter((m) => m.weightedContribution !== null);
  const excludedCount = gate.metrics.length - available.length;
  const effectiveWeight = available.reduce((sum, m) => sum + m.weight, 0);
  const weightedSum = available.reduce((sum, m) => sum + (m.weightedContribution ?? 0), 0);
  const isPartial = excludedCount > 0;

  return (
    <details className="group mt-3 rounded-lg border border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold text-foreground">
        How was the Gate Multiplier calculated?
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-border p-4 font-mono text-xs leading-relaxed text-muted-foreground">
        <div>
          <p className="mb-1 font-semibold text-foreground">Step 1 — Score each metric into a tier</p>
          {gate.metrics.map((m) => (
            <p key={m.key}>
              {m.name}: {m.actualDisplay} →{" "}
              {m.tier === null
                ? "No data — excluded, weight not counted"
                : `${m.tier} (tier score ${m.tierScore?.toFixed(2)}) × weight ${(m.weight * 100).toFixed(
                    0
                  )}% = ${m.weightedContribution?.toFixed(4)}`}
            </p>
          ))}
        </div>
        <div>
          <p className="font-semibold text-foreground">
            Step 2 — Weighted average of the available tier scores
            {isPartial ? " (renormalized to just the metrics with data)" : ""}
          </p>
          <p>Sum of contributions: {weightedSum.toFixed(4)}</p>
          {isPartial && <p>Effective weight used: {(effectiveWeight * 100).toFixed(0)}% of 100%</p>}
          <p>
            Gate Multiplier = {weightedSum.toFixed(4)} ÷ {effectiveWeight.toFixed(2)} = {gate.gateMultiplier.toFixed(4)}×
          </p>
        </div>
        <div className="rounded-md bg-primary-50 p-3 font-sans text-sm font-semibold text-primary-700">
          Gate Multiplier: {gate.gateMultiplier.toFixed(4)}× → {gate.overallTier} overall
        </div>
      </div>
    </details>
  );
}
