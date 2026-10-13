"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GATE_TIER_SCORES, GATE_MULTIPLIER_MIN, GATE_MULTIPLIER_MAX } from "@/lib/scoring/thresholds";
import { buildGateScaleTable } from "@/lib/scoring/display";
import type { GateMetricKey } from "@/lib/scoring/types";

/**
 * Small "i" button that opens a plain-language explanation of the Business
 * Gate: what it is, how each metric is graded and combined, and where the
 * numbers come from. Drop it next to any Business Gate heading or figure.
 *
 * Everything printed (weights, tier bands, tier scores, multiplier limits)
 * is read from the same constants the scoring engine uses, so the
 * explanation can never drift from the real calculation.
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

export function GateInfoButton({ className, label = "What is the Business Gate?" }: { className?: string; label?: string }) {
  const [open, setOpen] = React.useState(false);
  const scale = React.useMemo(() => buildGateScaleTable(), []);

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
        title="About the Business Gate"
        description="What it is and how it is calculated."
        footer={
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1 text-sm leading-relaxed text-foreground">
          <section>
            <h3 className="mb-1 font-semibold">What it is</h3>
            <p className="text-muted-foreground">
              The Business Gate is a team-level multiplier, not an individual score. It reflects how the whole KYC team performed
              on four service measures, and it is applied to every agent&apos;s bonus: the agent&apos;s own score sets the bonus
              bracket first, then the Gate multiplier scales it. 100% (1.00×) means the bonus is paid as is; above 100% increases
              it, below 100% reduces it.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold">How it is worked out</h3>
            <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground marker:text-foreground">
              <li>Take the four team metrics for the period.</li>
              <li>Grade each metric into a tier using the scale below. For all four, lower is better.</li>
              <li>
                Turn each tier into a tier score:{" "}
                {GATE_TIER_SCORES.map((t, i) => (
                  <React.Fragment key={t.tier}>
                    {i > 0 && " · "}
                    <span className={cn("font-semibold", TIER_TEXT[t.tier])}>
                      {t.tier} = {t.score.toFixed(2)}
                    </span>
                  </React.Fragment>
                ))}
                .
              </li>
              <li>Multiply each tier score by that metric&apos;s weight and add the results together.</li>
              <li>
                If a metric has no data for the period, it is left out and the remaining weights are scaled back up to 100%.
                Missing data is never counted as zero.
              </li>
              <li>
                The result is the Gate multiplier, kept between {GATE_MULTIPLIER_MIN.toFixed(2)} and{" "}
                {GATE_MULTIPLIER_MAX.toFixed(2)}. Overall status: 115% or more is Exceptional, 100% to under 115% is Green, 70% to
                under 100% is Amber, and under 70% is Red.
              </li>
            </ol>
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
                      <td className="px-2.5 py-2 text-muted-foreground">{Math.round(r.weight * 100)}%</td>
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
            <h3 className="mb-1 font-semibold">Where the numbers come from</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground marker:text-border">
              <li>
                Each day&apos;s four gate figures come from the daily KYC Team Performance report imported for that day (or
                entered by hand on the Manual Entry page).
              </li>
              <li>
                Over a week or a month, Client Avg Wait Time and Team Processing Time are the plain average of the daily values.
              </li>
              <li>
                Chat Team Avg Response is weighted by each day&apos;s chat volume, and Team Ticket AHT by each day&apos;s email and
                KYB ticket volume (application tickets are not included), so busier days count for more.
              </li>
              <li>A day imported more than once counts once; for each figure the most recent import with a value is used.</li>
              <li>
                The Gate is recalculated from the stored daily data every time it is shown, so if a day is corrected or
                re-imported, the figure updates.
              </li>
            </ul>
          </section>
        </div>
      </Dialog>
    </>
  );
}
