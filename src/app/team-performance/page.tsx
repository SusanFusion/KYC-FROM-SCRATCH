import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TierBadge, tierTone } from "@/components/dashboard/PerformanceBadge";
import { MetricBlockCard } from "@/components/metrics/MetricBlockCard";
import { ScoringScaleTable } from "@/components/metrics/ScoringScaleTable";
import { Progress } from "@/components/ui/progress";
import { loadPeriodDataset } from "@/lib/data/query";
import { buildGateScaleTable } from "@/lib/scoring/display";
import { EmptyState } from "@/components/shared/EmptyState";

export default async function TeamPerformancePage() {
  const { period, results } = await loadPeriodDataset();
  const gate = results[0]?.gate;

  if (!period || !gate) {
    return (
      <>
        <TopHeader title="Team Performance" description="The Business Gate — Layer 1 of the KPI framework" />
        <PageShell>
          <EmptyState title="No team-level data yet" description="Import a report to see Business Gate metrics." actionLabel="Go to Data Import" actionHref="/import" />
        </PageShell>
      </>
    );
  }

  const teamAverage = results.length
    ? results.reduce((sum, r) => sum + r.individual.finalScore, 0) / results.length
    : 0;
  const { columns, rows } = buildGateScaleTable();

  return (
    <>
      <TopHeader title="Team Performance" description={`Business Gate (Layer 1) for ${period.label}`} />
      <PageShell>
        <Card>
          <CardHeader>
            <CardTitle>Business Gate Scoring Scale</CardTitle>
            <CardDescription>
              Each metric is scored into a tier; the weighted average of the tier scores becomes the multiplier applied to every agent&apos;s bonus.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScoringScaleTable columns={columns} rows={rows} title="Metric" />
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{period.label}</CardTitle>
            <CardDescription>This period&apos;s actuals against the scale above.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {gate.metrics.map((m) => (
                <MetricBlockCard
                  key={m.key}
                  label={m.name}
                  value={m.actualDisplay}
                  tone={tierTone(m.tier)}
                  badge={<TierBadge tier={m.tier} />}
                  bufferLabel={m.tierScore === null ? "Not available this period — excluded, not scored as 0" : m.bufferLabel}
                  bufferGood={m.bufferGood}
                  weightLabel={
                    m.tierScore !== null
                      ? `Weight ${(m.weight * 100).toFixed(0)}% · contributes ${m.weightedContribution?.toFixed(4)}`
                      : `Weight ${(m.weight * 100).toFixed(0)}%`
                  }
                  tooltip="Distance to the Amber threshold (the Green tier's boundary) — how much room is left before this metric needs attention."
                />
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-lg bg-primary-50 px-4 py-3">
              <span className="text-sm font-medium text-primary-700">Gate Multiplier</span>
              <span className="text-lg font-semibold text-primary-700">{gate.gateMultiplier.toFixed(4)}×</span>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Individual Scorecard Average (Layer 2)</CardTitle>
            <CardDescription>Average final score across all {results.length} scored agents this period, before the gate multiplier.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <span className="text-3xl font-semibold text-foreground">{teamAverage.toFixed(2)}</span>
              <span className="text-sm text-muted-foreground">/ 3.00</span>
              <Progress value={teamAverage} max={3} className="ml-4 flex-1" />
            </div>
          </CardContent>
        </Card>
      </PageShell>
    </>
  );
}
