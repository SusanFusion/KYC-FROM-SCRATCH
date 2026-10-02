"use client";

import * as React from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { clearIndividualMetricFieldAction } from "@/app/import/actions";

export interface AgentOption {
  id: string;
  name: string;
}

export interface MonthOption {
  key: string;
  label: string;
}

export interface FieldOption {
  key: string;
  label: string;
}

/** Data Import page's "clear a KPI field across a month" action -- Lead/
 *  Auditor-only (see page.tsx's canDeleteRawMetric, reused here since this
 *  is just as destructive). Distinct from both Import history's whole-
 *  day/period delete and RawMetricRecordsManager's single-day whole-record
 *  delete: this nulls out ONE chosen field, for ONE agent, across EVERY
 *  day already imported in the selected month, in one click -- for wiping
 *  a bad KPI that's wrong for an agent's entire month without having to
 *  delete each day's record (and every other field on it) one at a time. */
export function ClearMetricFieldForm({
  agents,
  months,
  fields,
}: {
  agents: AgentOption[];
  months: MonthOption[];
  fields: FieldOption[];
}) {
  const { showToast } = useToast();
  const [agentId, setAgentId] = React.useState(agents[0]?.id ?? "");
  const [monthKey, setMonthKey] = React.useState(months[0]?.key ?? "");
  const [field, setField] = React.useState(fields[0]?.key ?? "");
  const [pending, setPending] = React.useState(false);

  if (agents.length === 0 || months.length === 0) {
    return <p className="text-sm text-muted-foreground">No agents or imported months yet.</p>;
  }

  const agentName = agents.find((a) => a.id === agentId)?.name ?? "this agent";
  const monthLabel = months.find((m) => m.key === monthKey)?.label ?? "this month";
  const fieldLabel = fields.find((f) => f.key === field)?.label ?? "this field";

  async function handleClear() {
    if (
      !window.confirm(
        `Clear "${fieldLabel}" for ${agentName} across every imported day in ${monthLabel}? This can't be undone.`
      )
    ) {
      return;
    }
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("agentId", agentId);
      formData.set("monthKey", monthKey);
      formData.set("field", field);
      const result = await clearIndividualMetricFieldAction(formData);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast(
        result.clearedCount > 0
          ? `Cleared "${fieldLabel}" for ${agentName} on ${result.clearedCount} day${result.clearedCount === 1 ? "" : "s"} in ${monthLabel}.`
          : `${agentName} had no "${fieldLabel}" recorded in ${monthLabel} — nothing to clear.`,
        "success"
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Agent</span>
          <Select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Month</span>
          <Select value={monthKey} onChange={(e) => setMonthKey(e.target.value)}>
            {months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">KPI field</span>
          <Select value={field} onChange={(e) => setField(e.target.value)}>
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Button variant="danger" size="sm" onClick={handleClear} disabled={pending}>
        {pending ? "Clearing…" : "Clear this field for the whole month"}
      </Button>
    </div>
  );
}
