import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ScaleColumnDef, ScaleRow } from "@/lib/scoring/display";

const TONE_TEXT: Record<ScaleColumnDef["tone"], string> = {
  primary: "text-primary-600",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * Renders the "at-a-glance" threshold reference table for a set of metrics —
 * one row per metric, one column per tier (Exceptional/Green/Amber/Red, or
 * the individual-scorecard equivalents), plus each metric's weight.
 */
export function ScoringScaleTable({ columns, rows, title }: { columns: ScaleColumnDef[]; rows: ScaleRow[]; title?: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{title ?? "Metric"}</TableHead>
          {columns.map((c) => (
            <TableHead key={c.columnLabel} className={cn("text-center", TONE_TEXT[c.tone])}>
              {c.columnLabel}
            </TableHead>
          ))}
          <TableHead className="text-right">Weight</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="font-medium text-foreground">{row.name}</TableCell>
            {row.cells.map((cell, i) => (
              <TableCell key={columns[i]?.columnLabel ?? i} className={cn("text-center text-xs", TONE_TEXT[columns[i]?.tone ?? "primary"])}>
                {cell}
              </TableCell>
            ))}
            <TableCell className="text-right font-medium text-foreground">{(row.weight * 100).toFixed(0)}%</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
