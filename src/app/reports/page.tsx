import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PrintButton } from "@/components/shared/PrintButton";
import { loadPeriodDataset } from "@/lib/data/query";
import { formatPhp } from "@/lib/utils";
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
  const totalBonus = ranked.reduce((s, r) => s + r.bonus.totalBonusPhp, 0);

  return (
    <>
      <TopHeader title="Reports" description={`Summary report — ${period.label}`} actions={<PrintButton />} />
      <PageShell>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase text-muted-foreground">Total Bonus Payout</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatPhp(totalBonus)}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Full Agent Summary</CardTitle>
            <CardDescription>Final score, bracket, and bonus for every agent — {period.label}.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Bracket</TableHead>
                  <TableHead>Gate</TableHead>
                  <TableHead className="text-right">Bonus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((r, i) => (
                  <TableRow key={r.agent.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium text-foreground">{r.agent.name}</TableCell>
                    <TableCell>{r.individual.finalScore.toFixed(2)}</TableCell>
                    <TableCell>{r.bonus.bracket.label}</TableCell>
                    <TableCell>{r.bonus.gateMultiplier.toFixed(4)}×</TableCell>
                    <TableCell className="text-right font-medium text-foreground">{formatPhp(r.bonus.totalBonusPhp)}</TableCell>
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
