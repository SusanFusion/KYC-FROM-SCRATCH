import Link from "next/link";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AgentSearch } from "@/components/scorecard/AgentSearch";
import { loadRangeDataset, listAvailableMonths } from "@/lib/data/query";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import type { IndividualMetricKey, MetricScoreBreakdown } from "@/lib/scoring/types";
import { cn, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";

// Scores are derived fresh from live data on every request — see
// rankings/page.tsx for why this must never be served from a cached/stale
// build snapshot.
export const dynamic = "force-dynamic";

// Overall-score highlight threshold — deliberately independent of the
// per-metric grade bands (3/2/1/0): this is a single pass/fail line across
// the final 0–3 score, per explicit instruction.
const SCORE_PASS_THRESHOLD = 2.5;

function metricValue(metrics: MetricScoreBreakdown[], key: IndividualMetricKey) {
  return metrics.find((m) => m.key === key)?.actualDisplay ?? "—";
}

// Same light-tint formula as Team Performance's "emphasized" metric tiles
// (see MetricBlockCard's TONE_FILL) — a soft, whole-row wash rather than a
// loud solid color, so a full table of these stays easy on the eyes.
const ROW_TONE = {
  pass: "bg-success/10",
  fail: "bg-danger/10",
  noData: "bg-muted/40",
};

export default async function ScorecardsPage() {
  const months = await listAvailableMonths();

  if (months.length === 0) {
    return (
      <>
        <TopHeader title="Individual Scorecards" description="Per-agent performance breakdown" />
        <PageShell>
          <EmptyState title="No agents scored yet" actionLabel="Import a report" actionHref="/import" />
        </PageShell>
      </>
    );
  }

  // Month-to-date rather than a single imported day — same reason Rankings
  // moved to loadRangeDataset (see rankings/page.tsx): a single day's import
  // can legitimately be missing a field most of the roster only has from a
  // different day's import (e.g. chat metrics land from a separate import
  // step than the main KYC report), which used to make most of the roster
  // read as "No data" here even though Rankings, aggregating the same
  // month, had it.
  const selectedMonth = months[0]!;
  const monthThruLabel = `${selectedMonth.label} (thru ${formatDate(selectedMonth.end)})`;
  const [{ period, ranked }, user] = await Promise.all([
    loadRangeDataset({
      start: selectedMonth.start,
      end: selectedMonth.end,
      label: monthThruLabel,
      id: `mtd-${selectedMonth.key}`,
      type: "month-to-date",
    }),
    getCurrentUser(),
  ]);

  // Alphabetical by name rather than by rank — this page is a roster to
  // look someone up in, not a leaderboard (that's what Rankings is for).
  const agentsAlphabetical = [...ranked].sort((a, b) => a.agent.name.localeCompare(b.agent.name));

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
                {agentsAlphabetical.map((r) => {
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
                    <TableRow key={r.agent.id} className={noDataYet ? ROW_TONE.noData : passing ? ROW_TONE.pass : ROW_TONE.fail}>
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
                          // Plain text here, not a pill — the row itself is
                          // already tinted (ROW_TONE.noData), so a second
                          // background on top of that would just look muddy.
                          <span className="text-xs font-medium text-muted-foreground">No data yet</span>
                        ) : (
                          <span className={cn("text-sm font-semibold", passing ? "text-success" : "text-danger")}>
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
