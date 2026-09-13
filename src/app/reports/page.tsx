import { Download, TrendingUp } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/shared/PrintButton";
import { RankMedal } from "@/components/rankings/RankMedal";
import { loadPeriodDataset } from "@/lib/data/query";
import { EmptyState } from "@/components/shared/EmptyState";

export default async function ReportsPage() {
  const { period, ranked } = await loadPeriodDataset();

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
        <Card className="border-primary-200 bg-primary-50/60">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary-700">Downloadable performance report</p>
              <p className="mt-1 max-w-xl text-sm text-primary-700/80">
                A self-contained HTML file for {period.label} — current standing per agent, statistical outlier
                flags on individual KPIs, and a short written summary of how the team did. Opens on its own and
                is safe to share as an email attachment.
              </p>
            </div>
            <a
              href="/api/reports/export"
              download
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              <Download className="h-4 w-4" />
              Download Report (HTML)
            </a>
          </CardContent>
        </Card>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          <TrendingUp className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            This report is a single-period snapshot — only one reporting period has been imported so far, so
            week-over-week trend lines aren&apos;t shown yet. Once a second period is imported via Data Import, trend
            charts will appear here and in the downloaded report automatically.
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
