import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { GradeBadge } from "@/components/dashboard/PerformanceBadge";
import type { MetricScoreBreakdown } from "@/lib/scoring/types";

export function ScoreBreakdown({ metrics }: { metrics: MetricScoreBreakdown[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Metric</TableHead>
          <TableHead>Actual</TableHead>
          <TableHead>Target</TableHead>
          <TableHead className="text-right">Weight</TableHead>
          <TableHead>Result</TableHead>
          <TableHead className="text-right">Points</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {metrics.map((m) => (
          <TableRow key={m.key}>
            <TableCell className="font-medium text-foreground">{m.name}</TableCell>
            <TableCell className="text-muted-foreground">{m.actualDisplay}</TableCell>
            <TableCell className="text-muted-foreground">{m.target}</TableCell>
            <TableCell className="text-right text-muted-foreground">{(m.weight * 100).toFixed(0)}%</TableCell>
            <TableCell>
              <GradeBadge grade={m.grade} label={m.gradeLabel} />
            </TableCell>
            <TableCell className="text-right font-medium text-foreground">
              {m.weightedPoints === null ? "excluded" : m.weightedPoints.toFixed(2)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
