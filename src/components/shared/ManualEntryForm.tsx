"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";

interface AgentOption {
  id: string;
  name: string;
}

interface PeriodOption {
  id: string;
  label: string;
  endDate: string;
}

const NEW_PERIOD_VALUE = "__new__";

/** Matches RawAgentMetrics fields exactly (see lib/scoring/types.ts) — this
 *  form fills the same raw inputs a parsed PDF row would. */
const INDIVIDUAL_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "totalChatConversations", label: "Total Chat Conversations", hint: "count" },
  { key: "avgFirstResponseTimeSec", label: "Chat First Response Time", hint: "seconds" },
  { key: "avgResponseTimeSec", label: "Chat Avg Response Time", hint: "seconds" },
  { key: "emailAHTSec", label: "Email AHT (incl. KYB)", hint: "seconds" },
  { key: "appAHTSec", label: "Application AHT – FD", hint: "seconds" },
  { key: "totalChats", label: "Total Chats (CSAT denominator)", hint: "count" },
  { key: "csatCount", label: "CSAT Count", hint: "count" },
  { key: "dsatCount", label: "DSAT Count", hint: "count" },
  { key: "qaAuditPct", label: "QA Audit", hint: "%" },
];

const GATE_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "clientAvgWaitTimeMin", label: "Client Avg Wait Time", hint: "minutes" },
  { key: "teamProcessingTimeMin", label: "Avg Team Processing Time", hint: "minutes" },
  { key: "chatTeamAvgResponseSec", label: "Chat Team Avg Response Time", hint: "seconds" },
  { key: "teamTicketAHTMin", label: "Team Ticket AHT", hint: "minutes" },
];

type CellValues = Record<string, Record<string, string>>; // agentId -> metricKey -> raw string

export function ManualEntryForm({ agents, periods }: { agents: AgentOption[]; periods: PeriodOption[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [phase, setPhase] = React.useState<"idle" | "saving" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  // Default to the current period (periods[0] — same "most recent" ordering
  // the rest of the app treats as "current") so adding, say, the two
  // Business Gate fields the PDF never reports actually lands on the same
  // period the dashboard is already showing, instead of quietly creating a
  // second period that never appears anywhere.
  const [targetPeriodId, setTargetPeriodId] = React.useState<string>(periods[0]?.id ?? NEW_PERIOD_VALUE);
  const [periodLabel, setPeriodLabel] = React.useState("");
  const [generatedDate, setGeneratedDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [gateValues, setGateValues] = React.useState<Record<string, string>>({});
  const [cells, setCells] = React.useState<CellValues>({});
  const [savedCount, setSavedCount] = React.useState(0);
  const isNewPeriod = targetPeriodId === NEW_PERIOD_VALUE;

  function setCell(agentId: string, metricKey: string, raw: string) {
    setCells((prev) => ({ ...prev, [agentId]: { ...(prev[agentId] ?? {}), [metricKey]: raw } }));
  }

  async function handleSave() {
    setErrorMsg(null);

    const entries: { agentId: string; metricKey: string; value: number }[] = [];
    for (const [agentId, byMetric] of Object.entries(cells)) {
      for (const [metricKey, raw] of Object.entries(byMetric)) {
        const trimmed = raw.trim();
        if (trimmed === "") continue;
        const value = Number(trimmed);
        if (Number.isFinite(value)) entries.push({ agentId, metricKey, value });
      }
    }

    const gate: Record<string, number> = {};
    for (const [key, raw] of Object.entries(gateValues)) {
      const trimmed = raw.trim();
      if (trimmed === "") continue;
      const value = Number(trimmed);
      if (Number.isFinite(value)) gate[key] = value;
    }

    if (entries.length === 0 && Object.keys(gate).length === 0) {
      setErrorMsg("Enter at least one value before saving.");
      setPhase("error");
      return;
    }
    if (isNewPeriod && !generatedDate) {
      setErrorMsg("Pick a date for this period.");
      setPhase("error");
      return;
    }

    setPhase("saving");
    try {
      const res = await fetch("/api/import/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodLabel: isNewPeriod ? periodLabel || null : null,
          generatedDate: isNewPeriod ? generatedDate : null,
          targetPeriodId: isNewPeriod ? null : targetPeriodId,
          gate,
          entries,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.detail ? `${data.error} (${data.detail})` : data.error ?? "Failed to save.");
        setPhase("error");
        return;
      }
      const agentsUpdated = data.agentsUpdated ?? 0;
      setSavedCount(agentsUpdated);
      setPhase("done");
      showToast(
        `Manual entry saved — ${agentsUpdated} agent${agentsUpdated === 1 ? "" : "s"} updated. Dashboard, rankings, and scorecards now reflect this data.`,
        "success"
      );
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error.");
      setPhase("error");
    }
  }

  function resetForm() {
    setCells({});
    setGateValues({});
    setTargetPeriodId(periods[0]?.id ?? NEW_PERIOD_VALUE);
    setPhase("idle");
    setErrorMsg(null);
  }

  if (phase === "done") {
    return (
      <Card className="border-success/30">
        <CardContent className="flex items-start gap-3 p-6">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" />
          <div>
            <p className="text-sm font-medium text-foreground">Saved</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {savedCount} agent{savedCount === 1 ? "" : "s"} updated — the dashboard, rankings, and scorecards
              now reflect this data.
            </p>
            <Button size="sm" className="mt-3" onClick={resetForm}>
              Enter another period
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {phase === "error" && errorMsg && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4">
          <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" />
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Which period is this for?</CardTitle>
          <CardDescription>
            Values you leave blank are treated as not measured — not scored as zero. Adding to an existing period only
            fills in what you enter here; everything else already recorded for it (from a PDF import or an earlier
            manual entry) stays exactly as it was.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Add this data to</label>
            <Select value={targetPeriodId} onChange={(e) => setTargetPeriodId(e.target.value)} className="w-full sm:w-auto">
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.id === periods[0]?.id ? " (current)" : ""}
                </option>
              ))}
              <option value={NEW_PERIOD_VALUE}>+ Start a new period</option>
            </Select>
            {!isNewPeriod && (
              <p className="mt-1 text-xs text-muted-foreground">
                Date on record for this period:{" "}
                <span className="font-medium text-foreground">
                  {formatDate(periods.find((p) => p.id === targetPeriodId)?.endDate ?? "")}
                </span>
              </p>
            )}
          </div>
          {isNewPeriod && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Period label (optional)</label>
                <Input placeholder="e.g. This Month" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Date for this period</label>
                <Input type="date" value={generatedDate} onChange={(e) => setGeneratedDate(e.target.value)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business Gate (team-level)</CardTitle>
          <CardDescription>
            Layer 1 — one value per metric for the whole team this period. Fill in only what you have; you can save with
            just one or two of these and nothing else on the page at all.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GATE_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {f.label} <span className="text-muted-foreground/70">({f.hint})</span>
              </label>
              <Input
                type="number"
                inputMode="decimal"
                value={gateValues[f.key] ?? ""}
                onChange={(e) => setGateValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Individual metrics (per agent)</CardTitle>
          <CardDescription>Layer 2 — fill in only the columns you have data for; the rest stay unmeasured.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="sticky left-0 z-10 min-w-[160px] bg-card p-2">Agent</th>
                  {INDIVIDUAL_FIELDS.map((f) => (
                    <th key={f.key} className="min-w-[110px] p-2 font-medium" title={f.label}>
                      {f.label} <span className="text-muted-foreground/70">({f.hint})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id} className="border-b border-border last:border-0">
                    <td className="sticky left-0 z-10 bg-card p-2 font-medium text-foreground">{agent.name}</td>
                    {INDIVIDUAL_FIELDS.map((f) => (
                      <td key={f.key} className="p-1.5">
                        <Input
                          type="number"
                          inputMode="decimal"
                          className="h-8"
                          value={cells[agent.id]?.[f.key] ?? ""}
                          onChange={(e) => setCell(agent.id, f.key, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={phase === "saving"}>
          {phase === "saving" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Save & apply to dashboard
            </>
          )}
        </Button>
        <Button variant="outline" onClick={resetForm} disabled={phase === "saving"}>
          Clear
        </Button>
      </div>
    </div>
  );
}
