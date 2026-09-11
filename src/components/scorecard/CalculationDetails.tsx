import { ChevronDown } from "lucide-react";
import { formatPhp } from "@/lib/utils";
import type { AgentPeriodResult } from "@/lib/data/query";

/** "How was this score calculated?" — a plain <details> element so it works with zero client JS. */
export function CalculationDetails({ result }: { result: AgentPeriodResult }) {
  const { individual, gate, bonus } = result;

  return (
    <details className="group rounded-lg border border-border" open>
      <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold text-foreground">
        How was this score calculated?
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-border p-4 font-mono text-xs leading-relaxed text-muted-foreground">
        <div>
          <p className="mb-1 font-semibold text-foreground">Step 1 — Score each metric (Layer 2)</p>
          {individual.metrics.map((m) => (
            <p key={m.key}>
              {m.name}: {m.actualDisplay} → {m.excluded ? "No data (excluded)" : m.gradeLabel} → Grade{" "}
              {m.grade ?? "—"} × weight {(m.weight * 100).toFixed(0)}% ={" "}
              {m.weightedPoints === null ? "excluded" : m.weightedPoints.toFixed(2)}
            </p>
          ))}
        </div>
        <div>
          <p className="font-semibold text-foreground">
            Base Score{individual.hasIncompleteData ? " (renormalized for missing data)" : ""}: {individual.baseScore.toFixed(2)}
          </p>
          {individual.penaltiesApplied.length > 0 && (
            <>
              <p className="mt-1 font-semibold text-danger">Penalties:</p>
              {individual.penaltiesApplied.map((p) => (
                <p key={p.code}>
                  {p.label} × {p.count} = -{p.deduction.toFixed(2)}
                </p>
              ))}
            </>
          )}
          <p className="mt-1 font-semibold text-foreground">
            Final Individual Score: {individual.baseScore.toFixed(2)} - {individual.penaltyTotal.toFixed(2)} ={" "}
            {individual.finalScore.toFixed(2)} / 3.00
          </p>
        </div>
        <div>
          <p className="mb-1 font-semibold text-foreground">Step 2 — Apply the Business Gate (Layer 1, team-level)</p>
          <p>Bonus bracket for {individual.finalScore.toFixed(2)}: {bonus.bracket.label} → {formatPhp(bonus.baseBonusPhp)}</p>
          <p>
            Gate multiplier this period: {gate.gateMultiplier.toFixed(4)} ({gate.overallTier})
          </p>
          <p>
            {formatPhp(bonus.baseBonusPhp)} × {gate.gateMultiplier.toFixed(4)} = {formatPhp(bonus.bonusAfterGate)}
          </p>
        </div>
        <div>
          <p className="mb-1 font-semibold text-foreground">Step 3 — Top performer bonus</p>
          <p>
            {bonus.isTopPerformer ? `+ ${formatPhp(bonus.topPerformerBonusPhp)} (Top 1 this period)` : "Not the Top 1 agent this period — no additional bonus."}
          </p>
        </div>
        <div className="rounded-md bg-primary-50 p-3 font-sans text-sm font-semibold text-primary-700">
          Final Bonus: {formatPhp(bonus.bonusAfterGate)} {bonus.isTopPerformer ? `+ ${formatPhp(bonus.topPerformerBonusPhp)} = ${formatPhp(bonus.totalBonusPhp)}` : `= ${formatPhp(bonus.totalBonusPhp)}`}
          {!bonus.tenureEligible && " — withheld pending tenure/quarter-completion verification"}
        </div>
      </div>
    </details>
  );
}
