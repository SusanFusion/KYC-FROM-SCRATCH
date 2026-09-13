import { Info } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MetricBarChart, type MetricBarDatum } from "@/components/charts/MetricBarChart";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { loadPeriodDataset } from "@/lib/data/query";
import { INDIVIDUAL_METRICS } from "@/lib/scoring";
import { EmptyState } from "@/components/shared/EmptyState";

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

  // With more than one period imported (via PDF or manual entry), build a
  // real point-per-period series instead of the single current-period dot —
  // each additional commit to a new period shows up here automatically,
  // nothing is backfilled or fabricated for periods that don't exist.
  const chronological = [...periods].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  const trendData: TrendPoint[] = hasHistory
    ? await Promise.all(
        chronological.map(async (p) => {
          const ds = p.id === period.id ? { results } : await loadPeriodDataset(p.id);
          const avg = ds.results.length
            ? ds.results.reduce((s, r) => s + r.individual.finalScore, 0) / ds.results.length
            : 0;
          return { period: p.label.split(" ")[0] ?? p.id, score: Number(avg.toFixed(2)) };
        })
      )
    : [{ period: period.label.split(" ")[0] ?? period.id, score: Number((results.length ? results.reduce((s, r) => s + r.individual.finalScore, 0) / results.length : 0).toFixed(2)) }];

  const metricAverages: MetricBarDatum[] = INDIVIDUAL_METRICS.map((def) => {
    const values = results
      .map((r) => r.individual.metrics.find((m) => m.key === def.key))
      .filter((m): m is NonNullable<typeof m> => !!m && m.grade !== null);
    const avgGrade = values.length ? values.reduce((s, m) => s + (m.grade ?? 0), 0) / values.length : 0;
    return {
      name: def.name.length > 22 ? def.name.slice(0, 20) + "…" : def.name,
      value: Number(avgGrade.toFixed(2)),
      color:
        avgGrade >= 2.5 ? "hsl(226 64% 52%)" : avgGrade >= 1.5 ? "hsl(152 58% 36%)" : avgGrade >= 0.75 ? "hsl(32 92% 48%)" : "hsl(358 70% 50%)",
    };
  });

  return (
    <>
      <TopHeader title="Trends" description="Performance over time, by metric and period" />
      <PageShell>
        {!hasHistory && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-primary-100 bg-primary-50 p-4 text-sm text-primary-700">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Only one reporting period (<strong>{period.label}</strong>) has been imported so far, so month-over-month trend
              lines aren&apos;t meaningful yet. Import additional periods via Data Import (PDF or manual entry) and this page
              will automatically chart the team average over time — nothing here is fabricated to fill the gap.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Team Average Score</CardTitle>
              <CardDescription>{hasHistory ? `Across all ${chronological.length} imported periods.` : "Current period only — more points will appear as periods are added."}</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart data={trendData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Average Grade by Metric</CardTitle>
              <CardDescription>0-3 scale, current period ({period.label}). Lower-is-better metrics are already converted to grade before averaging.</CardDescription>
            </CardHeader>
            <CardContent>
              <MetricBarChart data={metricAverages} />
            </CardContent>
          </Card>
        </div>
      </PageShell>
    </>
  );
}
