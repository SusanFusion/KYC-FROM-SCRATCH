import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PenaltyForm } from "@/components/scorecard/PenaltyForm";
import { DISCIPLINARY_PENALTIES, ATTENDANCE_PENALTIES, PENALTY_NOTE_DEDUCTION_TIMING } from "@/lib/scoring";
import { loadPeriodDataset } from "@/lib/data/query";

function PenaltyTable({ title, rows }: { title: string; rows: typeof DISCIPLINARY_PENALTIES }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Infraction</TableHead>
              <TableHead>Deduction</TableHead>
              <TableHead>Examples</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.code}>
                <TableCell className="font-medium text-foreground">{r.label}</TableCell>
                <TableCell>
                  <Badge variant="danger">-{r.deduction.toFixed(2)}</Badge>
                </TableCell>
                <TableCell className="max-w-md whitespace-normal text-xs text-muted-foreground">{r.example}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default async function PenaltiesPage() {
  const { period, agents, results } = await loadPeriodDataset();

  const recorded = results
    .flatMap((r) => r.individual.penaltiesApplied.map((p) => ({ ...p, agent: r.agent.name, agentId: r.agent.id })))
    .filter((p) => p.count > 0);

  return (
    <>
      <TopHeader title="Penalties" description="Disciplinary Penalty System & Attendance Penalty — replaces the old Progressive Sanction KPI" />
      <PageShell>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PenaltyTable title="Disciplinary Penalty System" rows={DISCIPLINARY_PENALTIES} />
          <PenaltyTable title="Attendance Penalty" rows={ATTENDANCE_PENALTIES} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{PENALTY_NOTE_DEDUCTION_TIMING}</p>

        {period && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Record a penalty</CardTitle>
              <CardDescription>Applies to {period.label}. Deductions apply immediately to the agent&apos;s individual score.</CardDescription>
            </CardHeader>
            <CardContent>
              <PenaltyForm agents={agents.map((a) => ({ id: a.id, name: a.name }))} periodId={period.id} />
            </CardContent>
          </Card>
        )}

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Recorded this period</CardTitle>
          </CardHeader>
          <CardContent>
            {recorded.length === 0 ? (
              <p className="text-sm text-muted-foreground">No penalties recorded for {period?.label ?? "this period"}.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Infraction</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead className="text-right">Deduction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recorded.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-foreground">{p.agent}</TableCell>
                      <TableCell>{p.label}</TableCell>
                      <TableCell>{p.count}</TableCell>
                      <TableCell className="text-right text-danger">-{p.deduction.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </PageShell>
    </>
  );
}
