// src/components/shared/ManualEntryForm.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Save, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { getLocalTodayIso } from "@/lib/utils";

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
// Sentinel ClearTarget.agentId value meaning "every agent", for the bulk
// clear action below — distinct from null, which means a Business Gate
// (team-level, not per-agent) field.
const ALL_AGENTS = "__all__";

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
  { key: "emailTicketCount", label: "Email Ticket Count (incl. KYB)", hint: "count" },
];

const GATE_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "clientAvgWaitTimeMin", label: "Client Avg Wait Time", hint: "minutes" },
  { key: "teamProcessingTimeMin", label: "Avg Team Processing Time", hint: "minutes" },
  { key: "chatTeamAvgResponseSec", label: "Chat Team Avg Response Time", hint: "seconds" },
  { key: "teamTicketAHTMin", label: "Team Ticket AHT", hint: "minutes" },
];

type CellValues = Record<string, Record<string, string>>; // agentId -> metricKey -> raw string
type SelectedCells = Record<string, Set<string>>; // agentId -> Set<metricKey>
type Category = "gate" | "individual";

interface ClearTarget {
  agentId: string | null; // null for a Business Gate field, ALL_AGENTS for a bulk clear
  agentLabel: string;
  metricKey: string;
  fieldLabel: string;
}

export function ManualEntryForm({ agents, periods }: { agents: AgentOption[]; periods: PeriodOption[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [phase, setPhase] = React.useState<"idle" | "saving" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  // Default to TODAY's period if one already exists (so, say, adding the two
  // Business Gate fields the PDF never reports lands on the same period as
  // today's earlier import instead of quietly creating a duplicate) — but
  // otherwise default to starting a brand new period, never to whichever
  // period is merely most recent. Every day is its own period now (see the
  // daily-import redesign); defaulting to "the current/most recent period"
  // regardless of its date meant a new day's entry could silently merge
  // into an earlier day's period if this dropdown wasn't switched to
  // "+ Start a new period" every time.
  const todayIso = getLocalTodayIso();
  const [targetPeriodId, setTargetPeriodId] = React.useState<string>(
    periods[0]?.endDate === todayIso ? periods[0].id : NEW_PERIOD_VALUE
  );
  const [periodLabel, setPeriodLabel] = React.useState("");
  const [generatedDate, setGeneratedDate] = React.useState(() => getLocalTodayIso());

  // What you're currently working on — purely a view switch between the two
  // sections below, not a data reset. Entries you've already ticked under
  // the OTHER category stay put when you flip this (handleSave always
  // gathers from both, regardless of which one is on screen), so you can
  // fill in a Business Gate number, switch to Individual to fix one agent,
  // and still save everything together.
  const [category, setCategory] = React.useState<Category | null>(null);

  const [gateValues, setGateValues] = React.useState<Record<string, string>>({});
  const [selectedGateFields, setSelectedGateFields] = React.useState<Set<string>>(new Set());

  const [selectedAgentId, setSelectedAgentId] = React.useState<string>("");
  const [cells, setCells] = React.useState<CellValues>({});
  const [selectedCells, setSelectedCells] = React.useState<SelectedCells>({});

  const [savedCount, setSavedCount] = React.useState(0);
  const isNewPeriod = targetPeriodId === NEW_PERIOD_VALUE;

  // A field that's pending a "clear to no data" confirmation — a separate,
  // deliberate action from saving a value (see confirmClear below). Only
  // meaningful for an EXISTING period; a brand-new period has nothing on
  // record yet to clear, so the Clear control is hidden while isNewPeriod.
  const [clearTarget, setClearTarget] = React.useState<ClearTarget | null>(null);
  const [clearing, setClearing] = React.useState(false);

  // Manual Entry never reads anything back off the record — not from a PDF
  // import, not from an earlier manual entry. Every box always starts
  // blank; picking an existing period above only decides which day this
  // save lands on/merges into (see commitImportRows.ts), never what shows
  // up pre-filled in the fields below. PDF data belongs to the Upload PDF
  // tab only — per Susan, Manual Entry should only ever show, and only
  // ever save, what's actually being typed in right here.

  function setGateValue(key: string, raw: string) {
    setGateValues((prev) => ({ ...prev, [key]: raw }));
    // Typing a value ticks its checkbox for you; unticking it later (even
    // with text still in the box) excludes it from what gets saved.
    if (raw.trim() !== "") {
      setSelectedGateFields((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    }
  }

  function toggleGateField(key: string) {
    setSelectedGateFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function removeGateEntry(key: string) {
    setSelectedGateFields((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function setCell(agentId: string, metricKey: string, raw: string) {
    setCells((prev) => ({ ...prev, [agentId]: { ...(prev[agentId] ?? {}), [metricKey]: raw } }));
    if (raw.trim() !== "") {
      setSelectedCells((prev) => {
        const updated = new Set(prev[agentId] ?? []);
        updated.add(metricKey);
        return { ...prev, [agentId]: updated };
      });
    }
  }

  function toggleCell(agentId: string, metricKey: string) {
    setSelectedCells((prev) => {
      const updated = new Set(prev[agentId] ?? []);
      if (updated.has(metricKey)) updated.delete(metricKey);
      else updated.add(metricKey);
      return { ...prev, [agentId]: updated };
    });
  }

  function removeIndividualEntry(agentId: string, metricKey: string) {
    setSelectedCells((prev) => {
      const updated = new Set(prev[agentId] ?? []);
      updated.delete(metricKey);
      return { ...prev, [agentId]: updated };
    });
  }

  async function confirmClear() {
    if (!clearTarget || isNewPeriod) return;
    setClearing(true);
    try {
      const isBulk = clearTarget.agentId === ALL_AGENTS;
      const res = await fetch("/api/import/clear-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodId: targetPeriodId,
          metricKey: clearTarget.metricKey,
          agentId: isBulk ? null : clearTarget.agentId,
          allAgents: isBulk,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail ? `${data.error} (${data.detail})` : data.error ?? "Failed to clear.", "error");
        return;
      }
      showToast(
        isBulk
          ? `Cleared ${clearTarget.fieldLabel} back to no data for ${data.clearedCount ?? "every"} agent${data.clearedCount === 1 ? "" : "s"}.`
          : `Cleared ${clearTarget.fieldLabel} for ${clearTarget.agentLabel} back to no data.`,
        "success"
      );
      setClearTarget(null);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unexpected error while clearing.", "error");
    } finally {
      setClearing(false);
    }
  }

  // What's actually going to be saved, in both sections — this drives the
  // "Entries so far" review list AND handleSave itself, so the list on
  // screen is never out of sync with what a click on Save would send.
  const gateEntryList = GATE_FIELDS.filter(
    (f) => selectedGateFields.has(f.key) && (gateValues[f.key] ?? "").trim() !== ""
  ).map((f) => ({ key: f.key, label: f.label, value: gateValues[f.key] ?? "" }));

  const individualEntryList: { agentId: string; agentName: string; metricKey: string; label: string; value: string }[] = [];
  for (const [agentId, metricSet] of Object.entries(selectedCells)) {
    const agentName = agents.find((a) => a.id === agentId)?.name ?? agentId;
    const byMetric: Record<string, string> = cells[agentId] ?? {};
    for (const metricKey of metricSet) {
      const raw = byMetric[metricKey] ?? "";
      if (raw.trim() === "") continue;
      const label = INDIVIDUAL_FIELDS.find((f) => f.key === metricKey)?.label ?? metricKey;
      individualEntryList.push({ agentId, agentName, metricKey, label, value: raw });
    }
  }

  async function handleSave() {
    setErrorMsg(null);

    const entries = individualEntryList
      .map(({ agentId, metricKey, value }) => ({ agentId, metricKey, value: Number(value) }))
      .filter((e) => Number.isFinite(e.value));

    const gate: Record<string, number> = {};
    for (const e of gateEntryList) {
      const value = Number(e.value);
      if (Number.isFinite(value)) gate[e.key] = value;
    }

    if (entries.length === 0 && Object.keys(gate).length === 0) {
      setErrorMsg("Tick at least one metric and enter a value before saving.");
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
    setCategory(null);
    setSelectedAgentId("");
    setCells({});
    setSelectedCells({});
    setGateValues({});
    setSelectedGateFields(new Set());
    setTargetPeriodId(periods[0]?.endDate === todayIso ? periods[0].id : NEW_PERIOD_VALUE);
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
            This only decides which day your entry is saved against — every field below always starts blank, whether
            you pick an existing period or start a new one. Manual Entry never shows or reuses data already on
            record (from a PDF upload or an earlier manual entry); to review what a day currently has, use Import
            History or the PDF Upload tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Date this data is for</label>
              {isNewPeriod ? (
                <Input type="date" value={generatedDate} onChange={(e) => setGeneratedDate(e.target.value)} className="w-full sm:w-auto" />
              ) : (
                <Input
                  type="date"
                  value={periods.find((p) => p.id === targetPeriodId)?.endDate ?? ""}
                  disabled
                  className="w-full opacity-70 sm:w-auto"
                />
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {isNewPeriod
                  ? "Pick the date this data is for."
                  : "Fixed to the date already on record for the period selected above."}
              </p>
            </div>
          </div>
          {isNewPeriod && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Period label (optional)</label>
              <Input
                placeholder="e.g. This Month"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                className="w-full sm:w-auto"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What are you entering?</CardTitle>
          <CardDescription>Pick one to open its section below — you can switch back and forth without losing what you&apos;ve entered in either.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" variant={category === "gate" ? "default" : "outline"} onClick={() => setCategory("gate")}>
            Team Performance / Business Gate
          </Button>
          <Button type="button" variant={category === "individual" ? "default" : "outline"} onClick={() => setCategory("individual")}>
            Individual agent
          </Button>
        </CardContent>
      </Card>

      {category === "gate" && (
        <Card>
          <CardHeader>
            <CardTitle>Business Gate (team-level)</CardTitle>
            <CardDescription>
              Select which metric(s) you&apos;re updating — tick a metric to include it in this save; typing a value
              ticks it for you automatically.
              {!isNewPeriod && " Use Clear if a field is stuck showing an old value and this period genuinely has no fresh number for it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GATE_FIELDS.map((f) => (
              <div key={f.key}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={selectedGateFields.has(f.key)}
                      onChange={() => toggleGateField(f.key)}
                      aria-label={`Include ${f.label} in this save`}
                      className="h-3.5 w-3.5 flex-shrink-0 rounded border-border accent-primary"
                    />
                    {f.label} <span className="text-muted-foreground/70">({f.hint})</span>
                  </label>
                  {!isNewPeriod && (
                    <button
                      type="button"
                      onClick={() => setClearTarget({ agentId: null, agentLabel: "the whole team", metricKey: f.key, fieldLabel: f.label })}
                      title={`Clear ${f.label} back to no data for this period`}
                      className="flex flex-shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="h-3 w-3" /> Clear
                    </button>
                  )}
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={gateValues[f.key] ?? ""}
                  onChange={(e) => setGateValue(f.key, e.target.value)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {category === "individual" && (
        <Card>
          <CardHeader>
            <CardTitle>Individual agent</CardTitle>
            <CardDescription>
              Select which officer, then which KPI(s) for them, and enter the value(s). Switching officers below keeps
              whatever you already entered for the previous one — nothing is lost, and you can queue up several
              officers before saving.
              {!isNewPeriod && " Use Clear next to a KPI if it's stuck showing an old value and this officer genuinely has no fresh number for it this period."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Officer</label>
              <Select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)} className="w-full sm:w-auto">
                <option value="">— Select an officer —</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>

            {selectedAgentId && (
              <div className="space-y-2 border-t border-border pt-3">
                {INDIVIDUAL_FIELDS.map((f) => {
                  const selectedAgentName = agents.find((a) => a.id === selectedAgentId)?.name ?? selectedAgentId;
                  return (
                    <div key={f.key} className="flex flex-wrap items-center gap-3">
                      <label className="flex w-full items-center gap-1.5 text-sm sm:w-72">
                        <input
                          type="checkbox"
                          checked={selectedCells[selectedAgentId]?.has(f.key) ?? false}
                          onChange={() => toggleCell(selectedAgentId, f.key)}
                          aria-label={`Include ${f.label} for this officer`}
                          className="h-3.5 w-3.5 flex-shrink-0 rounded border-border accent-primary"
                        />
                        {f.label} <span className="text-muted-foreground/70 text-xs">({f.hint})</span>
                      </label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        className="h-8 w-full sm:w-40"
                        value={cells[selectedAgentId]?.[f.key] ?? ""}
                        onChange={(e) => setCell(selectedAgentId, f.key, e.target.value)}
                      />
                      {!isNewPeriod && (
                        <button
                          type="button"
                          onClick={() =>
                            setClearTarget({ agentId: selectedAgentId, agentLabel: selectedAgentName, metricKey: f.key, fieldLabel: f.label })
                          }
                          title={`Clear ${f.label} back to no data for this officer`}
                          className="flex flex-shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="h-3 w-3" /> Clear
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {category === "individual" && !isNewPeriod && (
        <Card>
          <CardHeader>
            <CardTitle>Bulk clear</CardTitle>
            <CardDescription>
              Clear one KPI back to no data for every officer on the period selected above, in one go — for when a
              stale value (like QA Audit) is stuck across the whole roster instead of just one officer.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {INDIVIDUAL_FIELDS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setClearTarget({ agentId: ALL_AGENTS, agentLabel: "every agent", metricKey: f.key, fieldLabel: f.label })}
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="h-3 w-3" /> Clear {f.label} for everyone
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {(gateEntryList.length > 0 || individualEntryList.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Entries so far</CardTitle>
            <CardDescription>This is exactly what Save will send — remove anything here that shouldn&apos;t be included.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {gateEntryList.map((e) => (
              <div key={`gate-${e.key}`} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
                <span>
                  <span className="text-muted-foreground">Business Gate —</span> {e.label}:{" "}
                  <span className="font-medium text-foreground">{e.value}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeGateEntry(e.key)}
                  aria-label={`Remove ${e.label}`}
                  className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {individualEntryList.map((e) => (
              <div key={`ind-${e.agentId}-${e.metricKey}`} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
                <span>
                  <span className="text-muted-foreground">{e.agentName} —</span> {e.label}:{" "}
                  <span className="font-medium text-foreground">{e.value}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeIndividualEntry(e.agentId, e.metricKey)}
                  aria-label={`Remove ${e.label} for ${e.agentName}`}
                  className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
          Clear form
        </Button>
      </div>

      <Dialog
        open={clearTarget !== null}
        onOpenChange={(open) => !open && !clearing && setClearTarget(null)}
        title="Clear this field back to no data?"
        description={
          clearTarget
            ? `This immediately writes "no data" for ${clearTarget.fieldLabel} — ${clearTarget.agentLabel} — on the period selected above, overriding whatever's currently on record (including a stale value left over from something already deleted). It updates the dashboard and scorecards right away. This can't be undone from here — you'd need to enter a new value, or clear it again, to change it further.`
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setClearTarget(null)} disabled={clearing}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmClear} disabled={clearing}>
              {clearing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Clearing…
                </>
              ) : (
                "Clear to no data"
              )}
            </Button>
          </>
        }
      />
    </div>
  );
}
