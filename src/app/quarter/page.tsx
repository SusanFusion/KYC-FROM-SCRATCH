import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RangePicker } from "@/components/shared/RangePicker";
import { RankMedal } from "@/components/rankings/RankMedal";
import { TierBadge, tierTone } from "@/components/dashboard/PerformanceBadge";
import { TONE_GRADIENT } from "@/components/metrics/MetricBlockCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { loadRangeDataset, listAvailableQuarters, listAvailableMonths, type PeriodDataset } from "@/lib/data/query";
import { formatMonthLabel, monthRange } from "@/lib/data/dateRanges";
import { hasSufficientDataCoverage, SCORE_PASS_THRESHOLD } from "@/lib/scoring/thresholds";
import { REPEATED_OFFENSE_THRESHOLD } from "@/lib/scoring/penalties";
import {
  mean,
  quarterMonthKeys,
  quarterScoreFromMonths,
  round4,
  tierFromMultiplier,
  type AgentMonthGrade,
} from "@/lib/scoring/quarterSummary";
import { cn, formatDate } from "@/lib/utils";

// Derived fresh from live data on every request -- see rankings/page.tsx for
// why this must never be served from a cached build snapshot.
export const dynamic = "force-dynamic";

interface MonthColumn {
  key: string;
  label: string;
  /** Latest imported day this month, or null when nothing has been imported for it yet. */
  thru: string | null;
  dataset: PeriodDataset | null;
}

function monthGradeFor(dataset: PeriodDataset | null, agentId: string): AgentMonthGrade {
  const r = dataset?.results.find((x) => x.agent.id === agentId);
  if (!r || r.individual.effectiveWeight <= 0) return { grade: null, state: "none" };
  const sufficient = hasSufficientDataCoverage(r.individual.effectiveWeight);
  return { grade: r.individual.finalScore, state: sufficient ? "scored" : "limited" };
}

function gradeBadge(g: AgentMonthGrade) {
  if (g.grade === null) return <span className="text-muted-foreground">—</span>;
  const pass = g.grade >= SCORE_PASS_THRESHOLD;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={g.state === "limited" ? "outline" : pass ? "success" : "danger"}>{g.grade.toFixed(2)}</Badge>
      {g.state === "limited" && <span className="text-[10px] text-muted-foreground">limited data</span>}
    </span>
  );
}

export default async function QuarterPage({ searchParams }: { searchParams: { quarter?: string } }) {
  const quarters = await listAvailableQuarters();

  if (quarters.length === 0) {
    return (
      <>
        <TopHeader title="Quarter" description="Each month's overall grade and Business Gate, and the quarter average" />
        <PageShell>
          <EmptyState
            title="No daily imports yet"
            description="Import at least one day's report to see quarter figures."
            actionLabel="Go to Data Import"
            actionHref="/import"
          />
        </PageShell>
      </>
    );
  }

  const selectedQuarter = quarters.find((q) => q.key === searchParams.quarter) ?? quarters[0]!;
  const quarterThruLabel = `${selectedQuarter.label} (thru ${formatDate(selectedQuarter.end)})`;

  // The quarter's own dataset is only used for the roster and the automatic
  // Repeated Offenses summary; every grade and gate figure below comes from
  // the quarter's three calendar months, each scored exactly like Overall MTD.
  const quarterData = await loadRangeDataset({
    start: selectedQuarter.start,
    end: selectedQuarter.end,
    label: quarterThruLabel,
    id: `qtd-${selectedQuarter.key}`,
    type: "quarter-to-date",
  });

  const availableMonths = await listAvailableMonths();
  const monthColumns: MonthColumn[] = await Promise.all(
    quarterMonthKeys(selectedQuarter.start).map(async (key) => {
      const label = formatMonthLabel(`${key}-01`);
      const option = availableMonths.find((m) => m.key === key);
      if (!option) return { key, label, thru: null, dataset: null };
      const dataset = await loadRangeDataset({
        start: monthRange(option.end).start,
        end: option.end,
        label: `${label} (thru ${formatDate(option.end)})`,
        id: `mtd-${key}`,
        type: "month-to-date",
      });
      return { key, label, thru: option.end, dataset };
    })
  );

  const quarterPicker = (
    <RangePicker paramName="quarter" current={selectedQuarter.key} options={quarters.map((q) => ({ value: q.key, label: q.label }))} />
  );

  // ── Business Gate: one multiplier per month, then their average ────────
  const gateByMonth = monthColumns.map((m) => {
    const gate = m.dataset?.results[0]?.gate ?? null;
    // A month where no gate metric has any data reports a neutral 1.0000;
    // that is "no data", not a real Green month, so it must not be averaged in.
    const hasData = gate !== null && gate.metrics.some((g) => g.tierScore !== null);
    return { month: m, gate: hasData ? gate : null };
  });
  const gateMultipliers = gateByMonth.flatMap((g) => (g.gate ? [g.gate.gateMultiplier] : []));
  const averageMultiplierRaw = mean(gateMultipliers);
  const averageMultiplier = averageMultiplierRaw === null ? null : round4(averageMultiplierRaw);
  const averageTier = averageMultiplier === null ? null : tierFromMultiplier(averageMultiplier);

  // ── Agents: overall grade for each month, quarter score = their average ─
  const flagged = quarterData.repeatedOffenses ?? [];
  const deductionByAgent = new Map(flagged.map((f) => [f.agentId, f.alreadyRecorded ? 0 : f.deduction]));
  const agentNameById = new Map(quarterData.agents.map((a) => [a.id, a.name]));

  const agentRows = quarterData.agents.map((agent) => {
    const months = monthColumns.map((m) => monthGradeFor(m.dataset, agent.id));
    const deduction = deductionByAgent.get(agent.id) ?? 0;
    const score = quarterScoreFromMonths(months, deduction);
    const monthsCounted = months.filter((m) => m.state === "scored").length;
    return { agent, months, deduction, score, monthsCounted };
  });
  const ranked = agentRows
    .filter((r) => r.score !== null)
    .sort((a, b) => (b.score as number) - (a.score as number) || a.agent.name.localeCompare(b.agent.name));
  const unranked = agentRows.filter((r) => r.score === null).sort((a, b) => a.agent.name.localeCompare(b.agent.name));

  const teamAverage = mean(ranked.map((r) => r.score as number)) ?? 0;

  return (
    <>
      <TopHeader title="Quarter" description={`Monthly overall grades and Business Gates for ${quarterThruLabel}`} actions={quarterPicker} />
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
            <CardTitle>Business Gate — {selectedQuarter.label}</CardTitle>
            <CardDescription>
              The team-level Gate Multiplier for each month of the quarter, and the average of the months that have gate data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {gateByMonth.map(({ month, gate }) => (
                <div key={month.key} className={cn("rounded-lg border p-4", gate ? "border-border bg-card" : "border-dashed border-border bg-muted/30")}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{month.label}</p>
                  {gate ? (
                    <>
                      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">{gate.gateMultiplier.toFixed(4)}×</p>
                      <div className="mt-2">
                        <TierBadge tier={gate.overallTier} />
                      </div>
                      {month.thru && <p className="mt-2 text-[11px] text-muted-foreground">Imports through {formatDate(month.thru)}</p>}
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-2xl font-semibold text-muted-foreground">—</p>
                      <p className="mt-2 text-xs text-muted-foreground">{month.thru ? "No gate data this month" : "No imports yet"}</p>
                    </>
                  )}
                </div>
              ))}

              <div
                className={cn(
                  "flex flex-col justify-center rounded-lg border p-4",
                  averageTier ? TONE_GRADIENT[tierTone(averageTier)] : "border-dashed border-border bg-muted/30"
                )}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Quarter average</p>
                {averageMultiplier !== null && averageTier ? (
                  <>
                    <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">{averageMultiplier.toFixed(4)}×</p>
                    <div className="mt-2">
                      <TierBadge tier={averageTier} />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Average of {gateMultipliers.length} month{gateMultipliers.length === 1 ? "" : "s"} with gate data
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-2xl font-semibold text-muted-foreground">—</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Individual Scorecard Average (Layer 2)</CardTitle>
            <CardDescription>
              Average quarter score across {ranked.length} scored agent{ranked.length === 1 ? "" : "s"}
              {ranked.length + unranked.length !== ranked.length ? ` (of ${ranked.length + unranked.length} on the roster)` : ""}, before the gate multiplier.
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
            <CardTitle>Agent Overall Grades — {selectedQuarter.label}</CardTitle>
            <CardDescription>
              Each agent&apos;s overall grade for every month of the quarter (the same final score shown on Overall MTD, after that
              month&apos;s penalties). The quarter score is the average of those monthly grades, less the automatic Repeated Offenses
              deduction when it applies. A month with only limited data is shown but not counted; a month with no data is left out,
              not scored as 0.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[72px]">Rank</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Department</TableHead>
                  {monthColumns.map((m) => (
                    <TableHead key={m.key}>{m.label}</TableHead>
                  ))}
                  <TableHead>Repeated Offenses</TableHead>
                  <TableHead>Quarter Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...ranked, ...unranked].map((r, i) => {
                  const rank = r.score !== null ? i + 1 : null;
                  return (
                    <TableRow key={r.agent.id}>
                      <TableCell>{rank !== null ? <RankMedal rank={rank} size="sm" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="font-medium text-foreground">{r.agent.name}</TableCell>
                      <TableCell>{r.agent.department}</TableCell>
                      {r.months.map((g, idx) => (
                        <TableCell key={monthColumns[idx]!.key}>{gradeBadge(g)}</TableCell>
                      ))}
                      <TableCell>
                        {r.deduction > 0 ? <span className="text-danger">-{r.deduction.toFixed(2)}</span> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {r.score === null ? (
                          <Badge variant="outline">No data yet</Badge>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <Badge variant={r.score >= SCORE_PASS_THRESHOLD ? "success" : "danger"}>{r.score.toFixed(2)}</Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {r.monthsCounted} of {monthColumns.length} months
                            </span>
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
