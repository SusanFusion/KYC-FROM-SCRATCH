import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TierBadge, tierTone } from "@/components/dashboard/PerformanceBadge";
import { MetricBlockCard, TONE_GRADIENT } from "@/components/metrics/MetricBlockCard";
import { ScoringScaleTable } from "@/components/metrics/ScoringScaleTable";
import { GateCalculationDetails } from "@/components/metrics/GateCalculationDetails";
import { Progress } from "@/components/ui/progress";
import { RangePicker } from "@/components/shared/RangePicker";
import { loadRangeDataset, listAvailableWeeks } from "@/lib/data/query";
import { buildGateScaleTable } from "@/lib/scoring/display";
import { GATE_TIER_SCORES } from "@/lib/scoring/thresholds";
import type { GateTier } from "@/lib/scoring/types";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";

// Scores are derived fresh from live data on every request — see rankings/page.tsx
// for why this must never be served from a cached/stale build snapshot.
export const dynamic = "force-dynamic";

const GATE_TIER_DESCRIPTION: Record<GateTier, string> = {
  Exceptional: "smashing the target",
  Green: "hitting target",
  Amber: "below target",
  Red: "significantly missing",
};

export default async function TeamPerformancePage({ searchParams }: { searchParams: { week?: string } }) {
  const weeks = await listAvailableWeeks();

  if (weeks.length === 0) {
    return (
      <>
        <TopHeader title="Team Performance" description="The Business Gate — Layer 1 of the KPI framework" />
        <PageShell>
          <EmptyState title="No team-level data yet" description="Import a daily report to see Business Gate metrics." actionLabel="Go to Data Import" actionHref="/import" />
        </PageShell>
      </>
    );
  }

  // Defaults to the most recently imported week — Sunday through Saturday,
  // per the team's own week convention — with older weeks reachable via the
  // picker in the header.
  const selectedWeek = weeks.find((w) => w.start === searchParams.week) ?? weeks[0]!;
  const { period, results } = await loadRangeDataset({
    start: selectedWeek.start,
    end: selectedWeek.end,
    label: `Week of ${selectedWeek.label}`,
    id: `week-${selectedWeek.start}`,
    type: "weekly",
  });
  const gate = results[0]?.gate;

  const weekPicker = (
    <RangePicker paramName="week" current={selectedWeek.start} options={weeks.map((w) => ({ value: w.start, label: w.label }))} />
  );

  if (!period || !gate) {
    return (
      <>
        <TopHeader title="Team Performance" description="The Business Gate — Layer 1 of the KPI framework" actions={weekPicker} />
        <PageShell>
          <EmptyState title="No team-level data yet" description="Import a daily report to see Business Gate metrics." actionLabel="Go to Data Import" actionHref="/import" />
        </PageShell>
      </>
    );
  }

  // Rankings/Scorecards now list every agent on the roster, including
  // anyone with no import for this period yet (a 0.00 placeholder score —
  // see query.ts). Averaging that in here would understate the team's real
  // performance for every agent who simply hasn't been imported yet, so
  // this average is intentionally scoped to agents who actually have data.
  const scoredResults = results.filter((r) => r.individual.effectiveWeight > 0);
  const teamAverage = scoredResults.length
    ? scoredResults.reduce((sum, r) => sum + r.individual.finalScore, 0) / scoredResults.length
    : 0;
  const { columns, rows } = buildGateScaleTable();
  const multiplierToneRaw = tierTone(gate.overallTier);

  return (
    <>
      <TopHeader title="Team Performance" description={`Business Gate (Layer 1) for ${period.label}`} actions={weekPicker} />
      <PageShell>
        <Card>
          <CardHeader>
            <CardTitle>{period.label}</CardTitle>
            <CardDescription>Averaged across every day imported this week, against the scoring scale below.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Same MetricBlockCard tiles the Dashboard's and Overall MTD's
                Business Gate cards use -- the gradient wash + tone-colored
                ambient shadow is now MetricBlockCard's own "emphasized"
                look (see TONE_GRADIENT there), so every page that opts in
                gets the exact same finish for free. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {gate.metrics.map((m) => (
                <MetricBlockCard
                  key={m.key}
                  label={m.name}
                  value={m.actualDisplay}
                  tone={tierTone(m.tier)}
                  badge={<TierBadge tier={m.tier} />}
                  bufferLabel={m.tierScore === null ? "Not available this week — excluded, not scored as 0" : m.bufferLabel}
                  bufferGood={m.bufferGood}
                  weightLabel={
                    m.tierScore !== null
                      ? `Weight ${(m.weight * 100).toFixed(0)}% · contributes ${m.weightedContribution?.toFixed(4)}`
                      : `Weight ${(m.weight * 100).toFixed(0)}%`
                  }
                  tooltip="Distance to the Amber threshold (the Green tier's boundary) — how much room is left before this metric needs attention."
                  emphasized
                />
              ))}
            </div>

            {/* No ring here -- Susan wants this focused on the number
                itself. Same TONE_GRADIENT finish as the tiles above (now
                shared from MetricBlockCard.tsx rather than duplicated),
                tinted to the gate's own overall tier, built around one big
                figure instead of a ring + side text. */}
            <div
              className={cn(
                "mt-5 flex flex-col items-center gap-2 rounded-xl border p-6 text-center transition-all duration-200",
                TONE_GRADIENT[multiplierToneRaw]
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gate Multiplier</p>
              <p className="text-5xl font-bold tabular-nums tracking-tight text-foreground">{gate.gateMultiplier.toFixed(4)}×</p>
              <TierBadge tier={gate.overallTier} />
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Weighted average of the four tier scores above — applied to every agent&apos;s bonus this week.
              </p>
            </div>
            <GateCalculationDetails gate={gate} />
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Individual Scorecard Average (Layer 2)</CardTitle>
            <CardDescription>
              Average final score across {scoredResults.length} scored agent{scoredResults.length === 1 ? "" : "s"} this week
              {scoredResults.length !== results.length ? ` (of ${results.length} on the roster)` : ""}, before the gate multiplier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <span className="text-3xl font-semibold text-foreground">{teamAverage.toFixed(2)}</span>
              <span className="text-sm text-muted-foreground">/ 3.00</span>
              <Progress value={teamAverage} max={3} className="ml-4 flex-1" />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Business Gate Scoring Scale</CardTitle>
            <CardDescription>
              Reference only — each metric above is scored into a tier against these ranges; the weighted average of the tier scores becomes this week&apos;s team-level multiplier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScoringScaleTable columns={columns} rows={rows} title="Metric" />
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-border">
              {GATE_TIER_SCORES.map((t) => (
                <li key={t.tier}>
                  <span className="font-semibold text-foreground">
                    {t.tier} = {t.score.toFixed(2)}
                  </span>{" "}
                  ({GATE_TIER_DESCRIPTION[t.tier]})
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </PageShell>
    </>
  );
}
