import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PasswordGate } from "@/components/shared/PasswordGate";
import { PenaltyForm } from "@/components/scorecard/PenaltyForm";
import { PenaltyRecordsTable } from "@/components/scorecard/PenaltyRecordsTable";
import {
  DISCIPLINARY_PENALTIES,
  ATTENDANCE_PENALTIES,
  EMPLOYMENT_ACTIONS,
  PENALTY_NOTE_DEDUCTION_TIMING,
} from "@/lib/scoring";
import type { PenaltyDefinition } from "@/lib/scoring/types";
import { loadPeriodDataset } from "@/lib/data/query";
import { getRepository } from "@/lib/data/repository";
import { calculateAllPenalties } from "@/lib/scoring/penalties";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

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
  const { period, agents } = await loadPeriodDataset();

  // Every penalty ever recorded, for every agent -- NOT scoped to
  // `period.id`. This list is meant to be a durable running log of
  // everything anyone has recorded, and used to only look that way by
  // coincidence: every entry happened to share whatever period was
  // "current" at the time it was typed in, until a new daily import rolled
  // "current" forward and the whole list silently went to zero. See
  // calculateAllPenalties in penalties.ts.
  const repo = await getRepository();
  const allPenalties = await repo.getPenalties();
  const recorded = agents
    .flatMap((a) => calculateAllPenalties(a.id, allPenalties).map((p) => ({ ...p, agent: a.name, agentId: a.id })))
    .filter((p) => p.count > 0);

  // The disciplinary/attendance reference tables and the "Record a penalty"
  // form above stay visible to everyone (recording is already its own
  // password-gated action) -- only the actual log of WHO was penalized and
  // WHY, below, is restricted. Same !user-fails-open convention as
  // canSeeQaAudit elsewhere (e.g. scorecards/[agentId]/page.tsx) for when
  // there's no session to read.
  const user = await getCurrentUser();
  const canSeePenaltyLog = !user || user.role === "lead";

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

        {/* One shared unlock for both "Record a penalty" and "Recorded this
            period" below -- entering the password once used to only unlock
            whichever of the two you typed it into (each had its own
            PasswordGate, and each one's unlock state lives in that
            component's own client-side state), so you'd get asked again for
            the other. Wrapping both cards in a single PasswordGate instance
            means there's exactly one prompt and one unlock for the whole
            section. The Lead-only role check on the records table
            underneath is unchanged and independent of this -- an agent who
            knows the password can still open "Record a penalty" (unchanged
            from before), but the records table stays role-gated regardless
            of whether the password was entered. */}
        <PasswordGate description="Enter the shared Lead/Manager password to record or view penalties.">
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
              {!canSeePenaltyLog && <CardDescription>Visible to Leads/Managers only.</CardDescription>}
            </CardHeader>
            <CardContent>
              {canSeePenaltyLog ? (
                <PenaltyRecordsTable
                  records={recorded}
                  agents={agents.map((a) => ({ id: a.id, name: a.name }))}
                  periodLabel={period?.label ?? "this period"}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Penalty records are visible to Leads/Managers only.</p>
              )}
            </CardContent>
          </Card>
        </PasswordGate>
      </PageShell>
    </>
  );
}
