import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TierBadge, tierTone, type Tone } from "@/components/dashboard/PerformanceBadge";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { MetricBlockCard } from "@/components/metrics/MetricBlockCard";
import { ScoringScaleTable } from "@/components/metrics/ScoringScaleTable";
import { GateCalculationDetails } from "@/components/metrics/GateCalculationDetails";
import { Progress } from "@/components/ui/progress";
import { RangePicker } from "@/components/shared/RangePicker";
import { loadRangeDataset, listAvailableWeeks } from "@/lib/data/query";
import { buildGateScaleTable } from "@/lib/scoring/display";
import { GATE_TIER_SCORES, GATE_MULTIPLIER_MAX } from "@/lib/scoring/thresholds";
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

// A soft corner-lit gradient wash plus a matching colored ambient shadow,
// layered ON TOP of MetricBlockCard's own flat tone tint (emphasized=true) —
// passed in via `className` rather than editing the shared component, so
// this stays local to Team Performance and doesn't change how the same
// component looks on the Dashboard or Individual Scorecard pages. Kept as
// its own map (not exported) since nothing else needs this exact "elegant"
// treatment yet.
const TONE_GLOW: Record<Tone, string> = {
  primary:
    "bg-gradient-to-br from-primary/20 via-primary/5 to-transparent shadow-[0_10px_28px_-12px_hsl(var(--primary)/0.50)] hover:shadow-[0_16px_36px_-10px_hsl(var(--primary)/0.55)]",
  success:
    "bg-gradient-to-br from-success/20 via-success/5 to-transparent shadow-[0_10px_28px_-12px_hsl(var(--success)/0.45)] hover:shadow-[0_16px_36px_-10px_hsl(var(--success)/0.50)]",
  warning:
    "bg-gradient-to-br from-warning/20 via-warning/5 to-transparent shadow-[0_10px_28px_-12px_hsl(var(--warning)/0.45)] hover:shadow-[0_16px_36px_-10px_hsl(var(--warning)/0.50)]",
  danger:
    "bg-gradient-to-br from-danger/20 via-danger/5 to-transparent shadow-[0_10px_28px_-12px_hsl(var(--danger)/0.45)] hover:shadow-[0_16px_36px_-10px_hsl(var(--danger)/0.50)]",
  // "No data" tier — a quiet neutral wash, no colored glow (nothing to
  // highlight).
  muted: "bg-gradient-to-br from-muted/30 via-muted/10 to-transparent",
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
  // ScoreRing's tone prop only accepts the 4 "has a color" tones -- tierTone
  // returns the 5-way Tone union (it also covers "muted", for a null tier,
  // which can't happen here since gate.overallTier is always a real
  // GateTier).
  const multiplierToneRaw = tierTone(gate.overallTier);
  const multiplierTone = multiplierToneRaw === "muted" ? "primary" : multiplierToneRaw;

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
            {/* Same MetricBlockCard tiles the Dashboard's own Business Gate
                card uses, with an extra gradient wash + tone-colored ambient
                shadow layered on top via className (see TONE_GLOW above) --
                purely a local, elegant finish for this page rather than a
                change to the shared component's default look elsewhere. */}
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
                  className={TONE_GLOW[tierTone(m.tier)]}
                />
              ))}
            </div>

            {/* The one number that earns a hero ring -- same treatment the
                Dashboard gives its team average, scaled down to fit inside
                this card. Same gradient + colored-shadow finish as the
                tiles above, tinted to the gate's own overall tier. */}
            <div
              className={cn(
                "mt-5 flex flex-col items-center gap-5 rounded-xl border p-5 transition-all duration-200 sm:flex-row sm:justify-center sm:gap-8",
                tierTone(gate.overallTier) === "muted" ? "border-border" : "border-primary/20",
                TONE_GLOW[multiplierToneRaw]
              )}
            >
              <ScoreRing value={gate.gateMultiplier} max={GATE_MULTIPLIER_MAX} size={104} strokeWidth={9} tone={multiplierTone} label={gate.overallTier} />
              <div className="text-center sm:text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gate Multiplier</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{gate.gateMultiplier.toFixed(4)}×</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Weighted average of the four tier scores above — applied to every agent&apos;s bonus this week.
                </p>
              </div>
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
