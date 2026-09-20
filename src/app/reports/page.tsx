import { TrendingUp } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/shared/PrintButton";
import { PasswordGate } from "@/components/shared/PasswordGate";
import { RankMedal } from "@/components/rankings/RankMedal";
import { loadPeriodDataset, listAvailableWeeks, listAvailableMonths } from "@/lib/data/query";
import { EmptyState } from "@/components/shared/EmptyState";
import { ReportExportPicker } from "@/components/reports/ReportExportPicker";

export default async function ReportsPage() {
  const [{ period, ranked }, weeks, months] = await Promise.all([
    loadPeriodDataset(),
    listAvailableWeeks(),
    listAvailableMonths(),
  ]);

  if (!period) {
    return (
      <>
        <TopHeader title="Reports" description="Period summary" />
        <PageShell>
          <EmptyState title="No data yet" actionLabel="Import a report" actionHref="/import" />
        </PageShell>
      </>
    );
  }

  const teamAverage = ranked.reduce((s, r) => s + r.individual.finalScore, 0) / (ranked.length || 1);

  return (
    <>
      <TopHeader title="Reports" description={`Summary report — ${period.label}`} actions={<PrintButton />} />
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
            The &quot;Full Agent Summary&quot; table below is always a single-period snapshot for {period.label}. The
            Weekly Report export above includes a real week-over-week comparison once at least two weeks have been
            imported — with only one week on record so far, it shows this week alone.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase text-muted-foreground">Agents Scored</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{ranked.length}</p>
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
            <CardDescription>Final score for every agent — {period.label}.</CardDescription>
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
