import Link from "next/link";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AgentSearch } from "@/components/scorecard/AgentSearch";
import { loadPeriodDataset } from "@/lib/data/query";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import type { IndividualMetricKey, MetricScoreBreakdown } from "@/lib/scoring/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";

// Overall-score highlight threshold — deliberately independent of the
// per-metric grade bands (3/2/1/0): this is a single pass/fail line across
// the final 0–3 score, per explicit instruction.
const SCORE_PASS_THRESHOLD = 2.5;

function metricValue(metrics: MetricScoreBreakdown[], key: IndividualMetricKey) {
  return metrics.find((m) => m.key === key)?.actualDisplay ?? "—";
}

export default async function ScorecardsPage() {
  const [{ period, ranked }, user] = await Promise.all([loadPeriodDataset(), getCurrentUser()]);

  if (!period) {
    return (
      <>
        <TopHeader title="Individual Scorecards" description="Per-agent performance breakdown" />
        <PageShell>
          <EmptyState title="No agents scored yet" actionLabel="Import a report" actionHref="/import" />
        </PageShell>
      </>
    );
  }

  return (
    <>
      <TopHeader
        title="Individual Scorecards"
        description={`${ranked.length} agents · ${period.label}`}
        actions={<AgentSearch agents={ranked.map((r) => ({ id: r.agent.id, name: r.agent.name }))} />}
      />
      <PageShell>
        <Card>
          <CardContent className="p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>App AHT</TableHead>
                  <TableHead>Email AHT</TableHead>
                  <TableHead>Chat Response</TableHead>
                  <TableHead>First Response</TableHead>
                  <TableHead>CSAT</TableHead>
                  <TableHead>QA Audit</TableHead>
                  <TableHead className="text-right">Penalty</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((r) => {
                  // Same rule as the individual Scorecard page: an agent sees
                  // their own QA Audit result; Leads/Managers see everyone's.
                  const canSeeQaAudit = !user || user.role === "lead" || user.agentId === r.agent.id;
                  const passing = r.individual.finalScore >= SCORE_PASS_THRESHOLD;
                  // True only when NOT ONE metric has data yet this period —
                  // distinct from hasIncompleteData, which can also mean
                  // just one metric (e.g. QA Audit) is still missing. Shown
                  // as a plain "No data yet" pill instead of a 0.00 score,
                  // which would otherwise misrepresent an unimported agent
                  // as having failed.
                  const noDataYet = r.individual.effectiveWeight === 0;

                  return (
                    <TableRow key={r.agent.id}>
                      <TableCell>
                        <Link href={`/scorecards/${r.agent.id}`} className="font-medium text-foreground hover:underline">
                          {r.agent.name}
                        </Link>
                        {r.individual.hasIncompleteData && (
                          <Badge variant="outline" className="ml-2">
                            Incomplete
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{metricValue(r.individual.metrics, "appAHT")}</TableCell>
                      <TableCell className="text-muted-foreground">{metricValue(r.individual.metrics, "emailAHT")}</TableCell>
                      <TableCell className="text-muted-foreground">{metricValue(r.individual.metrics, "chatAvgResponse")}</TableCell>
                      <TableCell className="text-muted-foreground">{metricValue(r.individual.metrics, "chatFRT")}</TableCell>
                      <TableCell className="text-muted-foreground">{metricValue(r.individual.metrics, "csatDsat")}</TableCell>
                      <TableCell
                        className="text-muted-foreground"
                        title={canSeeQaAudit ? undefined : "Visible to this agent and Leads/Managers only"}
                      >
                        {canSeeQaAudit ? metricValue(r.individual.metrics, "qaAudit") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.individual.penaltyTotal > 0 ? (
                          <span className="font-medium text-danger">-{r.individual.penaltyTotal.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {noDataYet ? (
                          <span className="inline-flex min-w-[3.5rem] justify-center rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            No data yet
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex min-w-[3.5rem] justify-center rounded-md px-2.5 py-1 text-sm font-semibold",
                              passing ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                            )}
                          >
                            {r.individual.finalScore.toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageShell>
    </>
  );
}
