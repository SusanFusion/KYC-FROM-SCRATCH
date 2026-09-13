import Link from "next/link";
import { Target, Users, Trophy, Gauge, ArrowRight } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { GradeBadge, TierBadge, tierTone } from "@/components/dashboard/PerformanceBadge";
import { MetricBlockCard } from "@/components/metrics/MetricBlockCard";
import { RankMedal } from "@/components/rankings/RankMedal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { loadPeriodDataset } from "@/lib/data/query";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const { period, results, ranked, tieForTop } = await loadPeriodDataset();

  if (!period) {
    return (
      <>
        <TopHeader title="Dashboard" description="Overall KYC team performance" />
        <PageShell>
          <p className="text-sm text-muted-foreground">No performance data yet. Use Data Import to load a report.</p>
        </PageShell>
      </>
    );
  }

  const teamAverage = results.length
    ? results.reduce((sum, r) => sum + r.individual.finalScore, 0) / results.length
    : 0;
  const onTarget = results.filter((r) => r.individual.finalScore >= 2.4).length;
  const topPerformer = ranked[0];
  const incompleteCount = results.filter((r) => r.individual.hasIncompleteData).length;

  return (
    <>
      <TopHeader
        title="Dashboard"
        description={`Overview for ${period.label}`}
        actions={
          <Badge variant="outline">{period.type.replace(/-/g, " ")}</Badge>
        }
      />
      <PageShell>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Team Average Score"
            value={teamAverage.toFixed(2)}
            sublabel="out of 3.00 · Individual Scorecard (Layer 2)"
            icon={Gauge}
            tone={teamAverage >= 2.4 ? "success" : "warning"}
            statusBadge={<Badge variant={teamAverage >= 2.4 ? "success" : "warning"}>{teamAverage >= 2.4 ? "On Target" : "Needs Attention"}</Badge>}
          />
          <KpiCard
            label="Business Gate Multiplier"
            value={results[0] ? `${results[0].gate.gateMultiplier.toFixed(4)}×` : "—"}
            sublabel={results[0] ? `${results[0].gate.overallTier} · Layer 1, team-level` : "Team-level multiplier (Layer 1)"}
            icon={Target}
            tone={results[0] ? tierTone(results[0].gate.overallTier) : "muted"}
          />
          <KpiCard
            label="Agents On Target"
            value={`${onTarget} / ${results.length}`}
            sublabel="Final score ≥ 2.40"
            icon={Users}
            tone={results.length > 0 && onTarget === results.length ? "success" : "primary"}
          />
          <KpiCard
            label="Top Performer"
            value={topPerformer ? topPerformer.agent.name : "—"}
            sublabel={topPerformer ? `Score ${topPerformer.individual.finalScore.toFixed(2)}${tieForTop ? " (tied — confirm manually)" : ""}` : undefined}
            icon={Trophy}
            tone="primary"
          />
        </div>

        {/* Business Gate multiplier card needs the real value; render separately for clarity */}
        <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Business Gate — Layer 1</CardTitle>
                <CardDescription>Team-level multiplier applied to every agent&apos;s score this period.</CardDescription>
              </div>
              <Link href="/team-performance" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                View details <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-semibold text-foreground">
                  {(results[0]?.gate.gateMultiplier ?? 1).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}×
                </span>
                <TierBadge tier={results[0]?.gate.overallTier ?? null} />
                <span className="text-xs text-muted-foreground">
                  = {((results[0]?.gate.gateMultiplier ?? 1) * 100).toFixed(2)}% applied to the base score
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {results[0]?.gate.metrics.map((m) => (
                  <MetricBlockCard
                    key={m.key}
                    label={m.name}
                    value={m.actualDisplay}
                    tone={tierTone(m.tier)}
                    badge={<TierBadge tier={m.tier} />}
                    bufferLabel={m.tierScore === null ? "Not available this period" : m.bufferLabel}
                    bufferGood={m.bufferGood}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Quality</CardTitle>
              <CardDescription>Coverage for this period.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Agents scored</span>
                <span className="font-medium text-foreground">{results.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Incomplete data</span>
                <span className="font-medium text-foreground">{incompleteCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Gate metrics available</span>
                <span className="font-medium text-foreground">
                  {results[0]?.gate.metrics.filter((m) => m.tier !== null).length ?? 0} / 4
                </span>
              </div>
              <Link href="/settings" className="block text-xs text-primary hover:underline">
                See data notes &amp; assumptions →
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Top Rankings</CardTitle>
              <CardDescription>Highest final scores this period.</CardDescription>
            </div>
            <Link href="/rankings" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Full rankings <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {ranked.slice(0, 5).map((r, i) => (
                <Link
                  key={r.agent.id}
                  href={`/scorecards/${r.agent.id}`}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-muted",
                    i === 0 && "rank-row-gold",
                    i === 1 && "rank-row-silver",
                    i === 2 && "rank-row-bronze"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <RankMedal rank={i + 1} size="sm" />
                    <span className={cn("text-foreground", i < 3 ? "font-semibold" : "font-medium")}>{r.agent.name}</span>
                    {r.individual.hasIncompleteData && <Badge variant="outline">Incomplete</Badge>}
                  </div>
                  <GradeBadge grade={(r.individual.finalScore >= 3 ? 3 : r.individual.finalScore >= 2 ? 2 : r.individual.finalScore >= 1 ? 1 : 0) as 0 | 1 | 2 | 3} label={r.individual.finalScore.toFixed(2)} />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </PageShell>
    </>
  );
}
