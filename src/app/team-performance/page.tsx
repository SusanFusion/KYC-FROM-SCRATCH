import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TierBadge } from "@/components/dashboard/PerformanceBadge";
import { Progress } from "@/components/ui/progress";
import { loadPeriodDataset } from "@/lib/data/query";
import { GATE_TIER_SCORES } from "@/lib/scoring";
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

  return (
    <>
      <TopHeader title="Team Performance" description={`Business Gate (Layer 1) for ${period.label}`} />
      <PageShell>
        <Card>
          <CardHeader>
            <CardTitle>How the Gate Multiplier is calculated</CardTitle>
            <CardDescription>
              Each metric is scored into a tier, tiers convert to a score, and the weighted average of those scores is the multiplier applied to every agent&apos;s bonus.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-2">
              {GATE_TIER_SCORES.map((t) => (
                <Badge key={t.tier} variant="outline">
                  {t.tier} = {t.score.toFixed(2)}
                </Badge>
              ))}
            </div>
            <div className="space-y-3">
              {gate.metrics.map((m) => (
                <div key={m.key} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">Weight {(m.weight * 100).toFixed(0)}%</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{m.actualDisplay}</span>
                      <TierBadge tier={m.tier} />
                    </div>
                  </div>
                  {m.tierScore !== null && (
                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={m.tierScore} max={1.15} className="flex-1" />
                      <span className="w-32 text-right text-xs text-muted-foreground">
                        {m.tierScore.toFixed(2)} × {(m.weight * 100).toFixed(0)}% = {m.weightedContribution?.toFixed(4)}
                      </span>
                    </div>
                  )}
                  {m.tierScore === null && <p className="mt-2 text-xs text-muted-foreground">Not available in this period&apos;s import — excluded from the weighted average, not scored as 0.</p>}
                </div>
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
