"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GATE_TIER_SCORES, GATE_MULTIPLIER_MIN, GATE_MULTIPLIER_MAX } from "@/lib/scoring/thresholds";
import { buildGateScaleTable } from "@/lib/scoring/display";
import { getGateMetricSources } from "@/lib/scoring/gateMetricSources";
import type { BusinessGateResult, GateMetricKey } from "@/lib/scoring/types";

/**
 * Small "i" button that opens the Business Gate explainer. When it is given
 * the current gate result it leads with the exact computation behind the
 * figure on screen (every metric's value, tier, tier score, weight and
 * contribution, then the sum, the division and the final multiplier), and
 * keeps the plain-language "what it is / how it works" reference underneath.
 *
 * Weights, tier bands, tier scores and limits are all read from the same
 * constants the scoring engine uses, and the worked numbers come straight
 * from the gate result, so this can never disagree with the figure shown.
 */

const SHORT_LABEL: Record<GateMetricKey, string> = {
  clientAvgWaitTime: "Client Avg Wait Time",
  teamProcessingTime: "Team Processing Time",
  chatTeamAvgResponse: "Chat Team Avg Response",
  teamTicketAHT: "Team Ticket AHT",
};

const TIER_TEXT: Record<string, string> = {
  Exceptional: "text-primary-700",
  Green: "text-success",
  Amber: "text-warning",
  Red: "text-danger",
};

function pct(weight: number): string {
  return `${Math.round(weight * 100)}%`;
}

export function GateInfoButton({
  gate = null,
  periodLabel,
  className,
  label = "How is the Business Gate calculated?",
}: {
  /** The gate result currently shown on the page, for the worked calculation. */
  gate?: BusinessGateResult | null;
  /** e.g. "Sep 27 – Oct 3, 2026" or "October 2026 (thru Oct 12, 2026)". */
  periodLabel?: string;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const scale = React.useMemo(() => buildGateScaleTable(), []);
  const sources = React.useMemo(() => getGateMetricSources(), []);

  // ── Worked calculation for the figure currently on screen ──────────────
  const counted = gate ? gate.metrics.filter((m) => m.weightedContribution !== null) : [];
  const weightedSum = counted.reduce((s, m) => s + (m.weightedContribution ?? 0), 0);
  const effectiveWeight = counted.reduce((s, m) => s + m.weight, 0);
  const rawMultiplier = effectiveWeight > 0 ? weightedSum / effectiveWeight : 1;
  const wasClamped = gate ? Math.abs(Math.round(rawMultiplier * 10000) / 10000 - gate.gateMultiplier) > 0.00005 : false;

  function bandFor(key: GateMetricKey, tier: string | null): string {
    if (!tier) return "";
    const colIndex = scale.columns.findIndex((c) => c.columnLabel === tier);
    const row = scale.rows.find((r) => r.key === key);
    return colIndex >= 0 && row ? (row.cells[colIndex] ?? "") : "";
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <Info className="h-4 w-4" />
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={gate ? "Business Gate — current calculation" : "About the Business Gate"}
        description={gate ? (periodLabel ? `Exactly how ${periodLabel} was worked out.` : "Exactly how the figure on screen was worked out.") : "What it is and how it is calculated."}
        footer={
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="max-h-[65vh] space-y-6 overflow-y-auto pr-1 text-sm leading-relaxed text-foreground">
          {gate && (
            <section className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Gate multiplier</p>
                <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">{gate.gateMultiplier.toFixed(4)}×</p>
                <p className={cn("mt-1 text-sm font-semibold", TIER_TEXT[gate.overallTier])}>
                  {(gate.gateMultiplier * 100).toFixed(2)}% · {gate.overallTier}
                </p>
              </div>

              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[480px] text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-left text-muted-foreground">
                      <th className="px-2.5 py-2 font-semibold">Metric</th>
                      <th className="px-2.5 py-2 font-semibold">Value used</th>
                      <th className="px-2.5 py-2 font-semibold">Tier</th>
                      <th className="px-2.5 py-2 font-semibold">Score × Weight</th>
                      <th className="px-2.5 py-2 text-right font-semibold">Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gate.metrics.map((m) => (
                      <tr key={m.key} className="border-t border-border align-top">
                        <td className="px-2.5 py-2 font-medium">{SHORT_LABEL[m.key] ?? m.name}</td>
                        {m.tier === null || m.tierScore === null || m.weightedContribution === null ? (
                          <td colSpan={4} className="px-2.5 py-2 italic text-muted-foreground">
                            No data this period — left out (never counted as zero).
                          </td>
                        ) : (
                          <>
                            <td className="whitespace-nowrap px-2.5 py-2 font-semibold">{m.actualDisplay}</td>
                            <td className="px-2.5 py-2">
                              <span className={cn("font-semibold", TIER_TEXT[m.tier])}>{m.tier}</span>
                              <span className="block whitespace-nowrap text-[10px] text-muted-foreground">{bandFor(m.key, m.tier)}</span>
                            </td>
                            <td className="whitespace-nowrap px-2.5 py-2 text-muted-foreground">
                              {m.tierScore.toFixed(2)} × {pct(m.weight)}
                            </td>
                            <td className="px-2.5 py-2 text-right font-semibold tabular-nums">{m.weightedContribution.toFixed(4)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-muted-foreground">
                Sum {weightedSum.toFixed(4)} ÷ weight counted {effectiveWeight.toFixed(2)} ={" "}
                <span className={cn("font-semibold", TIER_TEXT[gate.overallTier])}>{gate.gateMultiplier.toFixed(4)}×</span>
                {counted.length < gate.metrics.length ? ". Metrics with no data are left out and the rest scaled up" : ""}
                {wasClamped
                  ? `. The raw result (${rawMultiplier.toFixed(4)}) is held to ${GATE_MULTIPLIER_MIN.toFixed(2)}–${GATE_MULTIPLIER_MAX.toFixed(2)}`
                  : ""}
                .
              </p>
            </section>
          )}

          <section>
            <h3 className="mb-1 font-semibold">How it works</h3>
            <p className="text-muted-foreground">
              The Gate is a team-level multiplier applied to every agent&apos;s bonus: 100% pays it as is, above 100% increases it,
              below 100% reduces it. Each metric is graded into a tier (
              {GATE_TIER_SCORES.map((t, i) => (
                <React.Fragment key={t.tier}>
                  {i > 0 && " · "}
                  <span className={cn("font-semibold", TIER_TEXT[t.tier])}>
                    {t.tier} = {t.score.toFixed(2)}
                  </span>
                </React.Fragment>
              ))}
              ), multiplied by its weight and added up. A metric with no data is left out and the rest scaled to 100%. The result is
              kept between {GATE_MULTIPLIER_MIN.toFixed(2)} and {GATE_MULTIPLIER_MAX.toFixed(2)}. Lower is better on all four.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold">Weights and tier scale</h3>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[460px] text-xs">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-2.5 py-2 font-semibold text-muted-foreground">Metric</th>
                    <th className="px-2.5 py-2 font-semibold text-muted-foreground">Weight</th>
                    {scale.columns.map((c) => (
                      <th key={c.columnLabel} className={cn("px-2.5 py-2 font-semibold", TIER_TEXT[c.columnLabel])}>
                        {c.columnLabel}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scale.rows.map((r) => (
                    <tr key={r.key} className="border-t border-border">
                      <td className="px-2.5 py-2 font-medium">{SHORT_LABEL[r.key as GateMetricKey] ?? r.name}</td>
                      <td className="px-2.5 py-2 text-muted-foreground">{pct(r.weight)}</td>
                      {r.cells.map((cell, i) => (
                        <td key={i} className="whitespace-nowrap px-2.5 py-2 text-muted-foreground">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="mb-1 font-semibold">What data each metric uses</h3>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[480px] text-xs">
                <thead>
                  <tr className="bg-muted/50 text-left text-muted-foreground">
                    <th className="px-2.5 py-2 font-semibold">Metric</th>
                    <th className="px-2.5 py-2 font-semibold">Measured from → to</th>
                    <th className="px-2.5 py-2 font-semibold">Recorded in</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((m) => (
                    <tr key={m.key} className="border-t border-border align-top">
                      <td className="px-2.5 py-2 font-medium">{m.label}</td>
                      <td className="px-2.5 py-2">{m.measures}</td>
                      <td className="whitespace-nowrap px-2.5 py-2 text-muted-foreground">{m.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Daily figures come from the daily KYC Team Performance report. Over a week or month, wait and processing times are
              averaged; chat response and ticket AHT are weighted by chat and ticket volume. A day imported twice counts once.
            </p>
          </section>
        </div>
      </Dialog>
    </>
  );
}
