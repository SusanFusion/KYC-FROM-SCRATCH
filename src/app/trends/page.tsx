import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { MetricDeltaGrid, deltaBadgeVariant, type MetricDeltaDatum } from "@/components/charts/MetricDeltaGrid";
import { loadPeriodDataset, type AgentPeriodResult } from "@/lib/data/query";
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

export default async function TrendsPage() {
  const { period, periods, results } = await loadPeriodDataset();

  if (!period) {
    return (
      <>
        <TopHeader title="Trends" description="Performance over time" />
        <PageShell>
          <EmptyState title="No data yet" actionLabel="Import a report" actionHref="/import" />
        </PageShell>
      </>
    );
  }

  const hasHistory = periods.length > 1;
  const chronological = [...periods].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));

  // The period immediately before the one currently shown — whichever two
  // periods are newest at the time of viewing. Nothing here is hardcoded to
  // a specific week: import a new period and this automatically becomes the
  // new "current", pushing today's current into the "previous" slot.
  const previousPeriod = hasHistory ? chronological[chronological.length - 2] ?? null : null;
  const previousResults = previousPeriod
    ? previousPeriod.id === period.id
      ? results
      : (await loadPeriodDataset(previousPeriod.id)).results
    : null;

  const trendData: TrendPoint[] = hasHistory
    ? await Promise.all(
        chronological.map(async (p) => {
          const rs = p.id === period.id ? results : p.id === previousPeriod?.id ? previousResults! : (await loadPeriodDataset(p.id)).results;
          const avg = teamAverage(rs);
          return { period: p.label.split(" ")[0] ?? p.id, score: Number((avg ?? 0).toFixed(2)) };
        })
      )
    : [{ period: period.label.split(" ")[0] ?? period.id, score: Number((teamAverage(results) ?? 0).toFixed(2)) }];

  const currentAvg = teamAverage(results);
  const previousAvg = previousResults ? teamAverage(previousResults) : null;
  const hasComparison = currentAvg !== null && previousAvg !== null;
  const scoreDelta = hasComparison ? Number((currentAvg! - previousAvg!).toFixed(2)) : null;
  const scoreFlat = scoreDelta !== null && Math.abs(scoreDelta) < 0.005;
  const scoreImproved = scoreDelta === null || scoreFlat ? null : scoreDelta > 0;

  const metricDeltas: MetricDeltaDatum[] = INDIVIDUAL_METRICS.map((def) => {
    const currentValue = metricAverageActual(results, def.key);
    const previousValue = previousResults ? metricAverageActual(previousResults, def.key) : null;

    const currentDisplay = currentValue !== null ? formatActual(def.key, currentValue) : "No data";
    const previousDisplay = previousResults ? (previousValue !== null ? formatActual(def.key, previousValue) : "No data") : null;

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
      <TopHeader title="Trends" description="This period vs. the last one, by team average and by metric" />
      <PageShell>
        {!hasHistory && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-primary-100 bg-primary-50 p-4 text-sm text-primary-700">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Only one reporting period (<strong>{period.label}</strong>) has been imported so far, so a period-over-period
              comparison isn&apos;t possible yet. Import the next period via Data Import (PDF or manual entry) and this page
              will automatically compare it against {period.label} — nothing here is fabricated to fill the gap.
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
                    ? `${period.label} vs. ${previousPeriod!.label}`
                    : hasHistory
                      ? `Across all ${chronological.length} imported periods.`
                      : "Current period only — a comparison appears once a second period is imported."}
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
                    {scoreFlat ? "No change" : `${scoreDelta! > 0 ? "+" : ""}${scoreDelta!.toFixed(2)} vs last period`}
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
            <CardDescription>
              {previousPeriod
                ? `Team average per metric, ${period.label} vs. ${previousPeriod.label}.`
                : `Team average per metric, ${period.label}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MetricDeltaGrid data={metricDeltas} />
          </CardContent>
        </Card>
      </PageShell>
    </>
  );
}
