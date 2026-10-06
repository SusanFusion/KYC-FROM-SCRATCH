import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RangePicker } from "@/components/shared/RangePicker";
import { RankingTable, type RankingRow } from "@/components/rankings/RankingTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { loadRangeDataset, listAvailableQuarters } from "@/lib/data/query";
import { hasSufficientDataCoverage } from "@/lib/scoring/thresholds";
import { REPEATED_OFFENSE_THRESHOLD } from "@/lib/scoring/penalties";
import { formatDate } from "@/lib/utils";

// Derived fresh from live data on every request -- see rankings/page.tsx for
// why this must never be served from a cached build snapshot.
export const dynamic = "force-dynamic";

export default async function QuarterPage({ searchParams }: { searchParams: { quarter?: string } }) {
  const quarters = await listAvailableQuarters();

  if (quarters.length === 0) {
    return (
      <>
        <TopHeader title="Quarter" description="Quarter-to-date average across every daily import" />
        <PageShell>
          <EmptyState
            title="No daily imports yet"
            description="Import at least one day's report to see quarter-to-date figures."
            actionLabel="Go to Data Import"
            actionHref="/import"
          />
        </PageShell>
      </>
    );
  }

  const selectedQuarter = quarters.find((q) => q.key === searchParams.quarter) ?? quarters[0]!;
  const quarterThruLabel = `${selectedQuarter.label} (thru ${formatDate(selectedQuarter.end)})`;
  const { results, ranked, teams, repeatedOffenses } = await loadRangeDataset({
    start: selectedQuarter.start,
    end: selectedQuarter.end,
    label: quarterThruLabel,
    id: `qtd-${selectedQuarter.key}`,
    type: "quarter-to-date",
  });

  const quarterPicker = (
    <RangePicker paramName="quarter" current={selectedQuarter.key} options={quarters.map((q) => ({ value: q.key, label: q.label }))} />
  );

  const agentNameById = new Map(results.map((r) => [r.agent.id, r.agent.name]));
  const flagged = repeatedOffenses ?? [];

  // Same exclusion as Overall MTD -- an agent with no import yet has a 0.00
  // placeholder that shouldn't drag the team average down.
  const scoredResults = results.filter((r) => r.individual.effectiveWeight > 0);
  const teamAverage = scoredResults.length
    ? scoredResults.reduce((sum, r) => sum + r.individual.finalScore, 0) / scoredResults.length
    : 0;

  const rankingRows: RankingRow[] = ranked.map((r) => ({
    agentId: r.agent.id,
    name: r.agent.name,
    department: r.agent.department,
    finalScore: r.individual.finalScore,
    hasIncompleteData: r.individual.hasIncompleteData,
    hasNoData: r.individual.effectiveWeight === 0,
    hasInsufficientData: r.individual.effectiveWeight > 0 && !hasSufficientDataCoverage(r.individual.effectiveWeight),
    appAHT: r.individual.metrics.find((m) => m.key === "appAHT")?.actualDisplay ?? "—",
    emailAHT: r.individual.metrics.find((m) => m.key === "emailAHT")?.actualDisplay ?? "—",
    chatAvgResponse: r.individual.metrics.find((m) => m.key === "chatAvgResponse")?.actualDisplay ?? "—",
    chatFRT: r.individual.metrics.find((m) => m.key === "chatFRT")?.actualDisplay ?? "—",
    csatDsat: r.individual.metrics.find((m) => m.key === "csatDsat")?.actualDisplay ?? "—",
    qaAudit: r.individual.metrics.find((m) => m.key === "qaAudit")?.actualDisplay ?? "—",
    appAHTPoint: r.individual.metrics.find((m) => m.key === "appAHT")?.grade ?? null,
    emailAHTPoint: r.individual.metrics.find((m) => m.key === "emailAHT")?.grade ?? null,
    chatAvgResponsePoint: r.individual.metrics.find((m) => m.key === "chatAvgResponse")?.grade ?? null,
    chatFRTPoint: r.individual.metrics.find((m) => m.key === "chatFRT")?.grade ?? null,
    csatDsatPoint: r.individual.metrics.find((m) => m.key === "csatDsat")?.grade ?? null,
    qaAuditPoint: r.individual.metrics.find((m) => m.key === "qaAudit")?.grade ?? null,
    // Includes the automatic Repeated Offenses deduction when it applies.
    penaltyTotal: r.individual.penaltyTotal,
  }));

  return (
    <>
      <TopHeader title="Quarter" description={`Quarter-to-date average for ${quarterThruLabel}`} actions={quarterPicker} />
      <PageShell>
        <Card>
          <CardHeader>
            <CardTitle>Repeated Offenses — {selectedQuarter.label}</CardTitle>
            <CardDescription>
              The same Disciplinary penalty recorded {REPEATED_OFFENSE_THRESHOLD} or more times in the quarter takes one extra -0.50
              off that agent&apos;s quarter score (once per agent per quarter).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {flagged.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agent has hit the Repeated Offenses rule this quarter.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Repeated penalty (times in quarter)</TableHead>
                    <TableHead>Hit on</TableHead>
                    <TableHead>Deduction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flagged.map((f) => (
                    <TableRow key={f.agentId}>
                      <TableCell className="font-medium text-foreground">{agentNameById.get(f.agentId) ?? f.agentId}</TableCell>
                      <TableCell className="whitespace-normal">{f.codes.map((c) => `${c.label} ×${c.count}`).join(", ")}</TableCell>
                      <TableCell>{formatDate(f.triggeredOn)}</TableCell>
                      <TableCell>
                        {f.alreadyRecorded ? (
                          <Badge variant="outline">Already recorded by hand</Badge>
                        ) : (
                          <Badge variant="danger">-{f.deduction.toFixed(2)}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Individual Scorecard Average (Layer 2)</CardTitle>
            <CardDescription>
              Average final score across {scoredResults.length} scored agent{scoredResults.length === 1 ? "" : "s"} this quarter
              {scoredResults.length !== results.length ? ` (of ${results.length} on the roster)` : ""}, before the gate multiplier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <span className="text-3xl font-semibold text-foreground">{teamAverage.toFixed(2)}</span>
              <span className="text-sm text-muted-foreground">/ 3.00</span>
              <Progress value={teamAverage} max={3} className="ml-4 flex-1" />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Agent Rankings — Quarter</CardTitle>
            <CardDescription>
              Every agent&apos;s score averaged across each day imported so far this quarter, with every penalty recorded in the
              quarter (including Repeated Offenses) deducted. &quot;Total Deduction&quot; shows the combined amount.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <RankingTable rows={rankingRows} departments={teams.map((t) => t.name)} showDeductionColumn />
          </CardContent>
        </Card>
      </PageShell>
    </>
  );
}
