import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TierBadge, tierTone, type Tone } from "@/components/dashboard/PerformanceBadge";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { ScoringScaleTable } from "@/components/metrics/ScoringScaleTable";
import { GateCalculationDetails } from "@/components/metrics/GateCalculationDetails";
import { Progress } from "@/components/ui/progress";
import { RangePicker } from "@/components/shared/RangePicker";
import { loadRangeDataset, listAvailableWeeks } from "@/lib/data/query";
import { buildGateScaleTable } from "@/lib/scoring/display";
import { GATE_TIER_SCORES, GATE_MULTIPLIER_MAX } from "@/lib/scoring/thresholds";
import type { GateTier, GateMetricBreakdown } from "@/lib/scoring/types";
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

// Same soft whole-tile tint used for the Business Gate ring tiles on the
// Dashboard (the GateMetricRing pattern in src/app/page.tsx) — kept in sync
// so a metric's tone reads identically on both pages.
const GATE_TILE_TONE: Record<Tone, string> = {
  primary: "border-primary/25 bg-primary-50/70",
  success: "border-success/25 bg-success/12",
  warning: "border-warning/25 bg-warning/12",
  danger: "border-danger/25 bg-danger/12",
  muted: "border-border bg-muted/40",
};

/**
 * One Business Gate KPI as a color-coded ring tile — mirrors the
 * GateMetricRing pattern already live on the Dashboard. Duplicated locally
 * here (rather than shared) since this page's tiles also show the
 * weight/contribution line the Dashboard's don't.
 */
function GateMetricRing({ metric }: { metric: GateMetricBreakdown }) {
  const tone = tierTone(metric.tier);
  const ringTone = tone === "muted" ? "primary" : tone;
  const bufferLabel = metric.tierScore === null ? "Not available this week — excluded, not scored as 0" : metric.bufferLabel;
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-popover/40",
        GATE_TILE_TONE[tone]
      )}
    >
      <ScoreRing value={metric.tierScore ?? 0} max={GATE_MULTIPLIER_MAX} size={88} strokeWidth={8} tone={ringTone} label={metric.tier ?? "No Data"} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{metric.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold text-foreground">{metric.actualDisplay}</span>
          <TierBadge tier={metric.tier} />
        </div>
        {bufferLabel && (
          <p className={cn("mt-1.5 text-xs", metric.bufferGood === false ? "text-danger" : "text-muted-foreground")}>{bufferLabel}</p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          Weight {(metric.weight * 100).toFixed(0)}%
          {metric.tierScore !== null && ` · contributes ${metric.weightedContribution?.toFixed(4)}`}
        </p>
      </div>
    </div>
  );
}

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
  // GateTier) -- same downgrade GateMetricRing above does before handing
  // its own tone to ScoreRing.
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {gate.metrics.map((m) => (
                <GateMetricRing key={m.key} metric={m} />
              ))}
            </div>
            <div className="mt-5 flex flex-col items-center gap-4 rounded-lg border border-border bg-primary-50/60 p-5 sm:flex-row sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Gate Multiplier</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Weighted average of the four tier scores above — applied to every agent&apos;s bonus this week.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ScoreRing value={gate.gateMultiplier} max={GATE_MULTIPLIER_MAX} size={120} strokeWidth={10} tone={multiplierTone} label={gate.overallTier} />
                <span className="text-lg font-semibold text-foreground">{gate.gateMultiplier.toFixed(4)}×</span>
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
