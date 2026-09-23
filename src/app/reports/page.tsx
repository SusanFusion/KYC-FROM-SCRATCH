import { TrendingUp } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/shared/PrintButton";
import { PasswordGate } from "@/components/shared/PasswordGate";
import { RangePicker } from "@/components/shared/RangePicker";
import { RankMedal } from "@/components/rankings/RankMedal";
import { loadRangeDataset, listAvailableWeeks, listAvailableMonths } from "@/lib/data/query";
import { EmptyState } from "@/components/shared/EmptyState";
import { ReportExportPicker } from "@/components/reports/ReportExportPicker";
import { formatDate } from "@/lib/utils";

// Scores are derived fresh from live data on every request — same reason as
// rankings/page.tsx and mtd/page.tsx: this must never be served from a
// cached/stale build snapshot.
export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: { month?: string } }) {
  const [weeks, months] = await Promise.all([listAvailableWeeks(), listAvailableMonths()]);

  if (months.length === 0) {
    return (
      <>
        <TopHeader title="Reports" description="Month-to-date summary" />
        <PageShell>
          <EmptyState title="No data yet" actionLabel="Import a report" actionHref="/import" />
        </PageShell>
      </>
    );
  }

  const selectedMonth = months.find((m) => m.key === searchParams.month) ?? months[0]!;
  const monthThruLabel = `${selectedMonth.label} (thru ${formatDate(selectedMonth.end)})`;

  const { ranked } = await loadRangeDataset({
    start: selectedMonth.start,
    end: selectedMonth.end,
    label: monthThruLabel,
    id: `reports-${selectedMonth.key}`,
    type: "month-to-date",
  });

  // Same exclusion as Team Performance/Trends/Overall MTD — an agent with no
  // data at all this month has a 0.00 placeholder (see individualScore.ts's
  // effectiveWeight fallback) that shouldn't drag the team average down.
  const scoredResults = ranked.filter((r) => r.individual.effectiveWeight > 0);
  const teamAverage = scoredResults.length
    ? scoredResults.reduce((s, r) => s + r.individual.finalScore, 0) / scoredResults.length
    : 0;

  const monthPicker = (
    <RangePicker paramName="month" current={selectedMonth.key} options={months.map((m) => ({ value: m.key, label: m.label }))} />
  );

  return (
    <>
      <TopHeader
        title="Reports"
        description={`Month-to-date summary — ${monthThruLabel}`}
        actions={
          <>
            {monthPicker}
            <PrintButton />
          </>
        }
      />
      <PageShell>
        {/* Viewing this whole page (the summary stats and the full agent
            table below) needs no password — only downloading a report file
            does, so just this picker sits behind PasswordGate. Real
            enforcement is server-side, in /api/reports/export itself
            (see requireActionAccess.ts); this is only the matching UI. */}
        <PasswordGate description="Enter the shared Lead/Manager password to export a report.">
          <ReportExportPicker weeks={weeks} months={months} />
        </PasswordGate>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            The &quot;Full Agent Summary&quot; table below is a month-to-date average across every day imported so
            far for {selectedMonth.label} — pick a different month above to see an earlier one. The Weekly Report
            export above includes a real week-over-week comparison once at least two weeks have been imported.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase text-muted-foreground">Agents Scored</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{scoredResults.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase text-muted-foreground">Team Average Score</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{teamAverage.toFixed(2)} / 3.00</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Full Agent Summary</CardTitle>
            <CardDescription>Month-to-date final score for every agent — {monthThruLabel}.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((r, i) => (
                  <TableRow key={r.agent.id}>
                    <TableCell>
                      <RankMedal rank={i + 1} size="sm" />
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{r.agent.name}</TableCell>
                    <TableCell>{r.individual.finalScore.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {r.individual.hasIncompleteData ? <Badge variant="outline">Incomplete</Badge> : <Badge variant="success">Complete</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageShell>
    </>
  );
}
