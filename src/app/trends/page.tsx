import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RangePicker } from "@/components/shared/RangePicker";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { MetricTrendChart, type MetricTrendPoint } from "@/components/charts/MetricTrendChart";
import { MetricDeltaGrid, deltaBadgeVariant, type MetricDeltaDatum } from "@/components/charts/MetricDeltaGrid";
import {
  loadRangeDataset,
  listAvailableWeeks,
  loadAgentDailyTrend,
  loadGateDailyTrend,
  gateMultiplierOrNull,
  type AgentPeriodResult,
} from "@/lib/data/query";
import { shiftWeek, formatWeekLabel, formatWeekShortLabel } from "@/lib/data/dateRanges";
import { INDIVIDUAL_METRICS, GATE_METRICS, GATE_MULTIPLIER_MIN, GATE_MULTIPLIER_MAX } from "@/lib/scoring";
import { formatActual } from "@/lib/scoring/individualScore";
import { formatMagnitude, roundToDisplayPrecision } from "@/lib/scoring/display";
import type { IndividualMetricKey } from "@/lib/scoring/types";
import { EmptyState } from "@/components/shared/EmptyState";

export const dynamic = "force-dynamic";

// An agent with no import yet still gets a row (see query.ts) so Rankings
// and Scorecards can list them — but their 0.00 placeholder score has no
// business dragging a team average down. Every average on this page is
// scoped to agents who actually have data this period, same fix already
// applied on Team Performance.
function scoredOnly(results: AgentPeriodResult[]) {
  return results.filter((r) => r.individual.effectiveWeight > 0);
}

// The Business Gate multiplier is team-wide, not per-agent — every agent in
// a period's results carries the exact same `.gate`, computed once from
// that period's Business Gate metrics — so reading it off results[0] (with
// gateMultiplierOrNull's "no metrics at all" → null guard) is exact, not an
// approximation the way averaging individual scores across agents is.
function teamGateMultiplier(results: AgentPeriodResult[]): number | null {
  return results[0]?.gate ? gateMultiplierOrNull(results[0].gate) : null;
}

function metricAverageActual(results: AgentPeriodResult[], key: IndividualMetricKey): number | null {
  const values = scoredOnly(results)
    .map((r) => r.individual.metrics.find((m) => m.key === key))
    .filter((m): m is NonNullable<typeof m> => !!m && !m.excluded && m.actual !== null);
  if (!values.length) return null;
  return values.reduce((sum, m) => sum + (m.actual as number), 0) / values.length;
}

// How many weeks the trend line looks back — keeps the chart readable as
// more weekly history piles up rather than growing unbounded.
const MAX_CHART_WEEKS = 12;

// How many days the daily Business Gate Multiplier line looks back — same
// idea as MAX_CHART_WEEKS, just day-granular. No picker of its own (unlike
// Individual KPI Trends below); this is meant to sit quietly alongside the
// weekly number rather than add another control to learn.
const GATE_DAILY_TREND_DAYS = 30;

const DAY_RANGE_OPTIONS = [
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: { week?: string; officer?: string; days?: string };
}) {
  const weeks = await listAvailableWeeks(); // most recent first

  if (weeks.length === 0) {
    return (
      <>
        <TopHeader title="Trends" description="Performance over time" />
        <PageShell>
          <EmptyState title="No data yet" actionLabel="Import a report" actionHref="/import" />
        </PageShell>
      </>
    );
  }

  const selectedWeek = weeks.find((w) => w.start === searchParams.week) ?? weeks[0]!;
  const previousRange = shiftWeek(selectedWeek.start, -1);
  const previousLabel = formatWeekLabel(previousRange);

  const weekPicker = (
    <RangePicker paramName="week" current={selectedWeek.start} options={weeks.map((w) => ({ value: w.start, label: w.label }))} />
  );

  const [{ results }, { results: previousResults }, gateDailyTrend] = await Promise.all([
    loadRangeDataset({
      start: selectedWeek.start,
      end: selectedWeek.end,
      label: `Week of ${selectedWeek.label}`,
      id: `week-${selectedWeek.start}`,
      type: "weekly",
    }),
    loadRangeDataset({
      start: previousRange.start,
      end: previousRange.end,
      label: `Week of ${previousLabel}`,
      id: `week-${previousRange.start}`,
      type: "weekly",
    }),
    loadGateDailyTrend(GATE_DAILY_TREND_DAYS),
  ]);

  // Same actual/actualDisplay → value/display reshape MetricTrendChart
  // expects everywhere else on this page (gateWeeklySeries, agentDailySeries
  // below) — a day with no Business Gate report yet reads as a gap, not a
  // fabricated 1.0000×.
  const gateDailyPoints: MetricTrendPoint[] = gateDailyTrend.map((p) => ({
    label: p.label,
    value: p.multiplier,
    display: p.multiplier !== null ? `${p.multiplier.toFixed(4)}×` : "No data",
  }));

  // Whether there's more than just the currently-selected week's own data to
  // draw on at all — drives the "not enough history yet" banner below.
  const hasHistory = weeks.length > 1;

  // The chart looks back over the most recent weeks (oldest → newest). Each
  // entry captures the FULL dataset (not just .results) so the Business
  // Gate weekly charts below can reuse the same fetch instead of loading
  // every week's data a second time — the two "special" weeks reuse the
  // datasets already loaded above, exactly as before.
  const chartWeeks = [...weeks].slice(0, MAX_CHART_WEEKS).reverse();
  const chartDatasets = await Promise.all(
    chartWeeks.map(async (w) => {
      if (w.start === selectedWeek.start) return { week: w, results, gate: results[0]?.gate ?? null };
      if (w.start === previousRange.start) return { week: w, results: previousResults, gate: previousResults[0]?.gate ?? null };
      const ds = await loadRangeDataset({
        start: w.start,
        end: w.end,
        label: `Week of ${w.label}`,
        id: `week-${w.start}`,
        type: "weekly",
      });
      return { week: w, results: ds.results, gate: ds.results[0]?.gate ?? null };
    })
  );

  const trendData: TrendPoint[] = chartDatasets.map(({ week, gate }) => ({
    // week.label is already the full "Sep 7 – 13, 2026" range (built by
    // formatWeekLabel inside listAvailableWeeks) — using it here instead of
    // the short single-day label makes it clear this point covers a whole
    // week, not just the day it happens to be plotted under.
    period: week.label,
    score: gate ? gateMultiplierOrNull(gate) : null,
  }));

  // One line series per Business Gate metric, built from the exact same
  // per-week datasets above — a week with no Business Gate numbers at all
  // reads as a gap in the line, never a fabricated 0.
  const gateWeeklySeries = GATE_METRICS.map((def) => ({
    key: def.key,
    name: def.name,
    unit: def.unit,
    points: chartDatasets.map(({ week, gate }): MetricTrendPoint => {
      const m = gate?.metrics.find((mm) => mm.key === def.key);
      return {
        label: formatWeekShortLabel(week),
        value: m?.actual ?? null,
        display: m?.actualDisplay ?? "No data",
      };
    }),
  }));

  const currentMultiplier = teamGateMultiplier(results);
  const previousMultiplier = teamGateMultiplier(previousResults);
  const hasComparison = currentMultiplier !== null && previousMultiplier !== null;
  const multiplierDelta = hasComparison ? Number((currentMultiplier! - previousMultiplier!).toFixed(4)) : null;
  const multiplierFlat = multiplierDelta !== null && Math.abs(multiplierDelta) < 0.00005;
  const multiplierImproved = multiplierDelta === null || multiplierFlat ? null : multiplierDelta > 0;

  const metricDeltas: MetricDeltaDatum[] = INDIVIDUAL_METRICS.map((def) => {
    const currentValue = metricAverageActual(results, def.key);
    const previousValue = metricAverageActual(previousResults, def.key);

    const currentDisplay = currentValue !== null ? formatActual(def.key, currentValue) : "No data";
    const previousDisplay = previousValue !== null ? formatActual(def.key, previousValue) : "No data";

    let deltaLabel: string | null = null;
    let improved: boolean | null = null;
    let deltaDirection: "up" | "down" | "flat" | null = null;
    if (currentValue !== null && previousValue !== null) {
      // Snap both sides to the SAME granularity their own display string
      // uses (see roundToDisplayPrecision) before comparing — rounding to a
      // coarser grid (e.g. 0.1 minute = 6-second buckets) than the "was X →
      // now Y" strings above (whole seconds) made the delta visibly
      // disagree with simple mental math on those two strings.
      const roundedCurrent = roundToDisplayPrecision(def.unit, currentValue);
      const roundedPrevious = roundToDisplayPrecision(def.unit, previousValue);
      const delta = roundedCurrent - roundedPrevious;
      if (Math.abs(delta) < 1e-9) {
        deltaLabel = "No change";
        deltaDirection = "flat";
      } else {
        deltaLabel = `${delta > 0 ? "+" : "−"}${formatMagnitude(def.unit, Math.abs(delta))}`;
        improved = def.direction === "lower-is-better" ? delta < 0 : delta > 0;
        deltaDirection = delta > 0 ? "up" : "down";
      }
    }

    return {
      key: def.key,
      name: def.name,
      currentDisplay,
      previousDisplay,
      deltaLabel,
      improved,
      deltaDirection,
    };
  });

  // Individual KPI Trends — full roster comes from this week's results
  // (every agent gets a row there even with no data yet, see query.ts), so
  // no separate fetch is needed just to populate the officer picker.
  const officerOptions = results.map((r) => ({ id: r.agent.id, name: r.agent.name })).sort((a, b) => a.name.localeCompare(b.name));
  const selectedOfficerId =
    (searchParams.officer && officerOptions.some((o) => o.id === searchParams.officer) ? searchParams.officer : undefined) ??
    officerOptions[0]?.id;
  const daysParam = DAY_RANGE_OPTIONS.some((o) => o.value === searchParams.days) ? searchParams.days! : "30";
  const daysWindow = daysParam === "all" ? null : Number(daysParam);

  // Same actual/actualDisplay → value/display reshape as gateWeeklySeries
  // above, so MetricTrendChart only ever has to know one point shape.
  const agentDailySeries = selectedOfficerId
    ? (await loadAgentDailyTrend(selectedOfficerId, daysWindow)).map((s) => ({
        key: s.key,
        name: s.name,
        unit: s.unit,
        points: s.points.map(
          (p): MetricTrendPoint => ({ label: p.label, value: p.actual, display: p.actualDisplay })
        ),
      }))
    : [];
  const selectedOfficerName = officerOptions.find((o) => o.id === selectedOfficerId)?.name;

  return (
    <>
      <TopHeader title="Trends" description="This week vs. last week, by Business Gate multiplier and by metric" actions={weekPicker} />
      <PageShell>
        {!hasHistory && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-primary-100 bg-primary-50 p-4 text-sm text-primary-700">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Only one week (<strong>{selectedWeek.label}</strong>) has been imported so far, so a week-over-week comparison
              isn&apos;t possible yet. Import daily reports for the next week and this page will automatically compare it
              against {selectedWeek.label} — nothing here is fabricated to fill the gap.
            </p>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Business Gate Multiplier</CardTitle>
                <CardDescription>
                  {hasComparison
                    ? `${selectedWeek.label} vs. ${previousLabel}`
                    : hasHistory
                      ? `Across the last ${chartWeeks.length} week${chartWeeks.length === 1 ? "" : "s"} imported.`
                      : "Current week only — a comparison appears once the prior week has data."}
                </CardDescription>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-semibold text-foreground">
                  {currentMultiplier !== null ? `${currentMultiplier.toFixed(4)}×` : "—"}
                </span>
                {currentMultiplier === null && (
                  <span className="text-sm text-muted-foreground">No Business Gate data this week yet</span>
                )}
                {hasComparison && (
                  <Badge variant={deltaBadgeVariant(multiplierImproved)}>
                    {multiplierFlat ? (
                      <Minus className="h-3 w-3" />
                    ) : multiplierImproved ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {multiplierFlat
                      ? "No change"
                      : `${multiplierDelta! > 0 ? "+" : ""}${multiplierDelta!.toFixed(4)} vs last week`}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={trendData}
              domain={[GATE_MULTIPLIER_MIN, GATE_MULTIPLIER_MAX]}
              ticks={[GATE_MULTIPLIER_MIN, 0.7, 1.0, GATE_MULTIPLIER_MAX]}
              precision={4}
              suffix="×"
              tooltipLabel="Business Gate multiplier"
            />
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-1 text-xs font-medium text-foreground">
                Daily <span className="text-muted-foreground/70">(Business Gate multiplier, last {GATE_DAILY_TREND_DAYS} days)</span>
              </p>
              <p className="mb-2 text-xs text-muted-foreground">
                The chart above compares whole weeks. This line ticks day by day instead, so you can see movement between
                weekly snapshots.
              </p>
              <MetricTrendChart data={gateDailyPoints} />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>By Metric</CardTitle>
            <CardDescription>Team average per metric, {selectedWeek.label} vs. {previousLabel}.</CardDescription>
          </CardHeader>
          <CardContent>
            <MetricDeltaGrid data={metricDeltas} />
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Business Gate Trends</CardTitle>
            <CardDescription>
              Weekly, across the last {chartWeeks.length} week{chartWeeks.length === 1 ? "" : "s"} imported — the same team-level
              numbers behind the Business Gate multiplier on Team Performance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {gateWeeklySeries.map((s) => (
                <div key={s.key} className="rounded-lg border border-border p-3">
                  <p className="mb-1 text-xs font-medium text-foreground">
                    {s.name} <span className="text-muted-foreground/70">({s.unit})</span>
                  </p>
                  <MetricTrendChart data={s.points} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Individual KPI Trends</CardTitle>
                <CardDescription>
                  {selectedOfficerName
                    ? `${selectedOfficerName}'s daily numbers, ${daysParam === "all" ? "every day on record" : `the last ${daysParam} days`}.`
                    : "Pick an officer to see their daily KPI trends."}
                </CardDescription>
              </div>
              {officerOptions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <RangePicker
                    paramName="officer"
                    current={selectedOfficerId!}
                    options={officerOptions.map((o) => ({ value: o.id, label: o.name }))}
                  />
                  <RangePicker paramName="days" current={daysParam} options={DAY_RANGE_OPTIONS} />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {officerOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No officers on the roster yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {agentDailySeries.map((s) => (
                  <div key={s.key} className="rounded-lg border border-border p-3">
                    <p className="mb-1 text-xs font-medium text-foreground">
                      {s.name} <span className="text-muted-foreground/70">({s.unit})</span>
                    </p>
                    <MetricTrendChart data={s.points} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PageShell>
    </>
  );
}
