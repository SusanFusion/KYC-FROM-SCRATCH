"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { DeleteRawMetricButton } from "@/components/shared/DeleteRawMetricButton";

export interface RawMetricRecordRow {
  agentId: string;
  agentName: string;
  periodId: string;
  /** Human labels (see metricFieldLabel) of every individual-metric field
   *  this record actually has a value for -- empty when the row exists
   *  (e.g. from a gate-only import) but carries no per-agent numbers. */
  fieldsTouched: string[];
}

export interface PeriodOption {
  id: string;
  label: string;
}

/** Data Import page's "delete a specific KPI record" section -- Lead/
 *  Auditor-only (see import/page.tsx's canDeleteRawMetric, which omits
 *  this component entirely for anyone else). Deliberately separate from
 *  Import history above: that deletes a whole day's import/period, this
 *  deletes one agent's single record for one period, same distinction the
 *  repository layer makes between deletePeriod and deleteRawMetric. */
export function RawMetricRecordsManager({
  records,
  periods,
}: {
  records: RawMetricRecordRow[];
  periods: PeriodOption[];
}) {
  const [periodId, setPeriodId] = React.useState(periods[0]?.id ?? "");
  const selectedPeriod = periods.find((p) => p.id === periodId);
  const rows = records.filter((r) => r.periodId === periodId);

  if (periods.length === 0) {
    return <p className="text-sm text-muted-foreground">No periods with data yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Period</span>
        <Select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No KPI records for this period.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.agentId} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{row.agentName}</p>
                {row.fieldsTouched.length > 0 ? (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {row.fieldsTouched.map((label) => (
                      <Badge key={label} variant="outline" className="text-[10px] font-normal">
                        {label}
                      </Badge>
                    ))}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">No individual fields recorded.</p>
                )}
              </div>
              <DeleteRawMetricButton
                agentId={row.agentId}
                periodId={row.periodId}
                agentName={row.agentName}
                periodLabel={selectedPeriod?.label ?? "this period"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
