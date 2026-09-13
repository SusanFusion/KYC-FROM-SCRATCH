import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GradeBadge, gradeTone } from "@/components/dashboard/PerformanceBadge";
import { RankMedal } from "@/components/rankings/RankMedal";
import { MetricBlockCard } from "@/components/metrics/MetricBlockCard";
import { ScoringScaleTable } from "@/components/metrics/ScoringScaleTable";
import { ScoreBreakdown } from "@/components/scorecard/ScoreBreakdown";
import { CalculationDetails } from "@/components/scorecard/CalculationDetails";
import { loadAgentPeriodResult } from "@/lib/data/query";
import { buildIndividualScaleTable } from "@/lib/scoring/display";
import { initials } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export default async function AgentScorecardPage({ params }: { params: { agentId: string } }) {
  const [{ result, rank, dataset }, user] = await Promise.all([
    loadAgentPeriodResult(params.agentId),
    getCurrentUser(),
  ]);

  if (!result || !dataset.period) notFound();

  const { agent, individual } = result;
  const { columns, rows } = buildIndividualScaleTable();

  // QA Audit results are restricted: an agent only sees this section on
  // their OWN scorecard; Leads/Managers see it on every scorecard. (Every
  // other metric here is visible to everyone regardless of role.)
  const canSeeQaAudit = !user || user.role === "lead" || user.agentId === params.agentId;
  const visibleMetrics = canSeeQaAudit ? individual.metrics : individual.metrics.filter((m) => m.key !== "qaAudit");
  const visibleResult = canSeeQaAudit ? result : { ...result, individual: { ...individual, metrics: visibleMetrics } };

  return (
    <>
      <TopHeader
        title={agent.name}
        description={`${agent.department} · ${dataset.period.label}`}
        actions={
          <Link href="/scorecards" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All scorecards
          </Link>
        }
      />
      <PageShell>
        <Card>
          <CardContent className="flex flex-wrap items-center gap-6 p-6">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-lg font-semibold text-primary-700">
              {initials(agent.name)}
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-foreground">{agent.name}</h2>
                {individual.hasIncompleteData && <Badge variant="outline">Incomplete data</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                Rank #{rank} of {dataset.ranked.length} · {agent.department}
              </p>
            </div>
            <div className="flex items-center gap-3 text-right">
              {rank !== null && <RankMedal rank={rank} size="lg" />}
              <div>
                <p className="text-3xl font-semibold text-foreground">{individual.finalScore.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">/ 3.00 final score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Individual Scorecard Scoring Scale</CardTitle>
            <CardDescription>Every metric that feeds the score (Layer 2), per the Proposed Individual Grading Scales.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoringScaleTable columns={columns} rows={rows} title="Metric" />
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{agent.name}&apos;s metrics this period</CardTitle>
            <CardDescription>Actuals against the scale above.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleMetrics.map((m) => (
                <MetricBlockCard
                  key={m.key}
                  label={m.name}
                  value={m.actualDisplay}
                  tone={gradeTone(m.grade)}
                  badge={<GradeBadge grade={m.grade} label={m.gradeLabel} />}
                  bufferLabel={m.excluded ? "No data this period — excluded, weights renormalized" : m.bufferLabel}
                  bufferGood={m.bufferGood}
                  weightLabel={m.excluded ? `Weight ${(m.weight * 100).toFixed(0)}%` : `Weight ${(m.weight * 100).toFixed(0)}% · ${m.weightedPoints?.toFixed(2)} pts`}
                  tooltip={`Target: ${m.target}. Distance shown is to the On Target / Below Target boundary.`}
                />
              ))}
            </div>
            {!canSeeQaAudit && (
              <p className="mt-3 text-xs text-muted-foreground">
                QA Audit results for this agent are only visible to {agent.name} and to Leads/Managers.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Detailed Breakdown</CardTitle>
              <CardDescription>Every metric that feeds the individual scorecard (Layer 2), per the Proposed Individual Grading Scales.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScoreBreakdown metrics={visibleMetrics} />
              {individual.hasIncompleteData && (
                <p className="mt-3 text-xs text-muted-foreground">
                  * Metrics marked &quot;No Data&quot; are excluded from the total and the remaining weights are renormalized — see Settings → Data Notes.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Penalties this period</CardTitle>
              <CardDescription>Deductions applied before the Business Gate.</CardDescription>
            </CardHeader>
            <CardContent>
              {individual.penaltiesApplied.length === 0 ? (
                <p className="text-sm text-muted-foreground">No penalties recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {individual.penaltiesApplied.map((p) => (
                    <li key={p.code} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                      <span className="text-foreground">
                        {p.label} {p.count > 1 && <span className="text-muted-foreground">×{p.count}</span>}
                      </span>
                      <span className="font-medium text-danger">-{p.deduction.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/penalties" className="mt-3 block text-xs text-primary hover:underline">
                Manage penalties →
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4">
          <CalculationDetails result={visibleResult} />
        </div>
      </PageShell>
    </>
  );
}
