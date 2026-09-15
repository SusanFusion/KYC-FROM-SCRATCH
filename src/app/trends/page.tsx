import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RangePicker } from "@/components/shared/RangePicker";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { MetricDeltaGrid, deltaBadgeVariant, type MetricDeltaDatum } from "@/components/charts/MetricDeltaGrid";
import { loadRangeDataset, listAvailableWeeks, type AgentPeriodResult } from "@/lib/data/query";
import { shiftWeek, formatWeekLabel, formatWeekShortLabel } from "@/lib/data/dateRanges";
import { INDIVIDUAL_METRICS } from "@/lib/scoring";
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

function teamAverage(results: AgentPeriodResult[]): number | null {
  const scored = scoredOnly(results);
  return scored.length ? scored.reduce((sum, r) => sum + r.individual.finalScore, 0) / scored.length : null;
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

export default async function TrendsPage({ searchParams }: { searchParams: { week?: string } }) {
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

  const [{ results }, { results: previousResults }] = await Promise.all([
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
  ]);

  // Whether there's more than just the currently-selected week's own data to
  // draw on at all — drives the "not enough history yet" banner below.
  const hasHistory = weeks.length > 1;

  // The chart looks back over the most recent weeks (oldest → newest), reusing
  // the two datasets already loaded above instead of re-fetching them.
  const chartWeeks = [...weeks].slice(0, MAX_CHART_WEEKS).reverse();
  const trendData: TrendPoint[] = await Promise.all(
    chartWeeks.map(async (w) => {
      const rs =
        w.start === selectedWeek.start
          ? results
          : w.start === previousRange.start
            ? previousResults
            : (
                await loadRangeDataset({
                  start: w.start,
                  end: w.end,
                  label: `Week of ${w.label}`,
                  id: `week-${w.start}`,
                  type: "weekly",
                })
              ).results;
      const avg = teamAverage(rs);
      return { period: formatWeekShortLabel(w), score: Number((avg ?? 0).toFixed(2)) };
    })
  );

  const currentAvg = teamAverage(results);
  const previousAvg = teamAverage(previousResults);
  const hasComparison = currentAvg !== null && previousAvg !== null;
  const scoreDelta = hasComparison ? Number((currentAvg! - previousAvg!).toFixed(2)) : null;
  const scoreFlat = scoreDelta !== null && Math.abs(scoreDelta) < 0.005;
  const scoreImproved = scoreDelta === null || scoreFlat ? null : scoreDelta > 0;

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

  return (
    <>
      <TopHeader title="Trends" description="This week vs. last week, by team average and by metric" actions={weekPicker} />
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
                <CardTitle>Team Average Score</CardTitle>
                <CardDescription>
                  {hasComparison
                    ? `${selectedWeek.label} vs. ${previousLabel}`
                    : hasHistory
                      ? `Across the last ${chartWeeks.length} week${chartWeeks.length === 1 ? "" : "s"} imported.`
                      : "Current week only — a comparison appears once the prior week has data."}
                </CardDescription>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-semibold text-foreground">{(currentAvg ?? 0).toFixed(2)}</span>
                <span className="text-sm text-muted-foreground">/ 3.00</span>
                {hasComparison && (
                  <Badge variant={deltaBadgeVariant(scoreImproved)}>
                    {scoreFlat ? (
                      <Minus className="h-3 w-3" />
                    ) : scoreImproved ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {scoreFlat ? "No change" : `${scoreDelta! > 0 ? "+" : ""}${scoreDelta!.toFixed(2)} vs last week`}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TrendChart data={trendData} />
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
      </PageShell>
    </>
  );
}
