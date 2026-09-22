import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PasswordGate } from "@/components/shared/PasswordGate";
import { PenaltyForm } from "@/components/scorecard/PenaltyForm";
import { DeletePenaltyButton } from "@/components/scorecard/DeletePenaltyButton";
import {
  DISCIPLINARY_PENALTIES,
  ATTENDANCE_PENALTIES,
  EMPLOYMENT_ACTIONS,
  PENALTY_NOTE_DEDUCTION_TIMING,
} from "@/lib/scoring";
import type { PenaltyDefinition } from "@/lib/scoring/types";
import { loadPeriodDataset } from "@/lib/data/query";
import { formatDate } from "@/lib/utils";

/** columnLabel switches this between the two disciplinary/attendance tables
 *  (a plain numeric "Deduction" column, every row here) and the employment
 *  track-record table (a "Status" column instead -- those rows all carry a
 *  `status` badge rather than a deduction, since it's always 0 for them). */
function PenaltyTable({ title, rows, columnLabel = "Deduction" }: { title: string; rows: PenaltyDefinition[]; columnLabel?: string }) {
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
              <TableHead>{columnLabel}</TableHead>
              <TableHead>Examples</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.code}>
                <TableCell className="font-medium text-foreground">{r.label}</TableCell>
                <TableCell>
                  {r.status ? (
                    <Badge variant={r.status.variant}>{r.status.label}</Badge>
                  ) : (
                    <Badge variant="danger">-{r.deduction.toFixed(2)}</Badge>
                  )}
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

        {/* Own row, full width -- these carry no deduction, so keeping them
            visually separate from the two score-affecting tables above
            makes that distinction obvious at a glance rather than needing
            the reader to check every row's numbers. */}
        <div className="mt-4">
          <PenaltyTable title="Employment Track Record Actions" rows={EMPLOYMENT_ACTIONS} columnLabel="Status" />
        </div>

        <p className="mt-3 text-xs text-muted-foreground">{PENALTY_NOTE_DEDUCTION_TIMING}</p>

        {period && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Record a penalty</CardTitle>
              <CardDescription>Applies to {period.label}. Deductions apply immediately to the agent&apos;s individual score.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Same shared Lead/Manager password as Data Import -- the
                  real enforcement is server-side in addPenaltyAction (see
                  actions.ts), this is just the matching prompt. */}
              <PasswordGate description="Enter the shared Lead/Manager password to record a penalty.">
                <PenaltyForm agents={agents.map((a) => ({ id: a.id, name: a.name }))} periodId={period.id} />
              </PasswordGate>
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
                    <TableHead>Date</TableHead>
                    <TableHead>Recorded by</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead className="text-right">Deduction</TableHead>
                    <TableHead className="text-right">&nbsp;</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recorded.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-foreground">{p.agent}</TableCell>
                      <TableCell>{p.label}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(p.occurredOn)}</TableCell>
                      <TableCell className="text-muted-foreground">{p.recordedBy}</TableCell>
                      <TableCell>{p.count}</TableCell>
                      <TableCell className="text-right">
                        {p.status ? (
                          <Badge variant={p.status.variant}>{p.status.label}</Badge>
                        ) : (
                          <span className="text-danger">-{p.deduction.toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DeletePenaltyButton id={p.id} agentId={p.agentId} />
                      </TableCell>
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
