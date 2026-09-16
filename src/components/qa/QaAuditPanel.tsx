"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Send, Download, Trash2, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatDate, getLocalTodayIso } from "@/lib/utils";
import { ROSTER } from "@/lib/auth/roster";
import {
  buildDefaultAnswers,
  computeAuditScore,
  getAuditDefinition,
  bandLabel,
  type QaAnswerValue,
  type QaAuditRecord,
  type QaAuditType,
} from "@/lib/qa/auditDefinitions";

interface AgentOption {
  id: string;
  name: string;
}
interface PeriodOption {
  id: string;
  label: string;
  endDate: string;
}

const AUDITORS = ROSTER.filter((r) => r.role === "lead");
const ANSWER_OPTIONS: { value: QaAnswerValue; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "na", label: "N/A" },
];

function bandBadgeVariant(band: 0 | 1 | 2 | 3 | null): "primary" | "success" | "warning" | "danger" | "outline" {
  if (band === null) return "outline";
  return band === 3 ? "primary" : band === 2 ? "success" : band === 1 ? "warning" : "danger";
}

function ScorePreview({ answers, auditType }: { answers: Record<string, QaAnswerValue | undefined>; auditType: QaAuditType }) {
  const definition = getAuditDefinition(auditType);
  const score = computeAuditScore(answers, definition);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
      <span className="font-medium text-foreground">
        {score.totalPoints}/{score.applicablePoints} points
        {score.percentage !== null ? ` · ${score.percentage.toFixed(1)}%` : " · no applicable answers yet"}
      </span>
      <Badge variant={bandBadgeVariant(score.band)}>{score.band !== null ? `Band ${score.band} — ${bandLabel(score.band)}` : "No data"}</Badge>
      {score.autoFail && (
        <Badge variant="danger" className="gap-1">
          <ShieldAlert className="h-3 w-3" /> Auto-Fail triggered
        </Badge>
      )}
    </div>
  );
}

function SubmitAuditForm({
  auditType,
  agents,
  periods,
  onSubmitted,
}: {
  auditType: QaAuditType;
  agents: AgentOption[];
  periods: PeriodOption[];
  onSubmitted: () => void;
}) {
  const { showToast } = useToast();
  const definition = getAuditDefinition(auditType);
  const [agentId, setAgentId] = React.useState(agents[0]?.id ?? "");
  const [periodId, setPeriodId] = React.useState(periods[0]?.id ?? "");
  const [auditorEmail, setAuditorEmail] = React.useState(AUDITORS[0]?.email ?? "");
  const [caseReference, setCaseReference] = React.useState("");
  const [auditDate, setAuditDate] = React.useState(() => getLocalTodayIso());
const [answers, setAnswers] = React.useState<Record<string, QaAnswerValue | undefined>>(() => buildDefaultAnswers(definition));  const [overallRemarks, setOverallRemarks] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function setAnswer(key: string, value: QaAnswerValue) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

    function resetForm() {
    setAnswers(buildDefaultAnswers(definition));
    setCaseReference("");
    setOverallRemarks("");
    setAuditDate(getLocalTodayIso());
  }

  async function handleSubmit() {
    setError(null);
    if (!agentId || !periodId || !auditorEmail) {
      setError("Pick an agent, a period, and an auditor.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/qa-audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditType,
          agentId,
          periodId,
          auditorEmail,
          caseReference: caseReference || null,
          auditDate,
          answers,
          overallRemarks: overallRemarks || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save the audit.");
        return;
      }
      showToast("Audit submitted. Publish it from the History tab to reflect its score on the scorecard.", "success");
      resetForm();
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4">
          <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Audit details</CardTitle>
          <CardDescription>Who this audit is for, who conducted it, and which reporting period it counts toward.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Agent</label>
            <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="w-full">
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Counts toward period</label>
            <Select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="w-full">
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Auditor (Lead/Manager)</label>
            <Select value={auditorEmail} onChange={(e) => setAuditorEmail(e.target.value)} className="w-full">
              {AUDITORS.map((a) => (
                <option key={a.email} value={a.email}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Audit date</label>
            <Input type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} className="w-full" />
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Case / ticket reference (optional)</label>
            <Input
              placeholder="e.g. application or ticket #"
              value={caseReference}
              onChange={(e) => setCaseReference(e.target.value)}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      <ScorePreview answers={answers} auditType={auditType} />

      {definition.sections.map((section) => (
        <Card key={section.key} className={section.autoFail ? "border-danger/40" : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {section.title}
              {section.autoFail && (
                <Badge variant="danger" className="gap-1">
                  <ShieldAlert className="h-3 w-3" /> Zero tolerance
                </Badge>
              )}
            </CardTitle>
            {section.autoFail && (
              <CardDescription>
                Defaults to &ldquo;No&rdquo; (violation did not occur) with no penalty. A single &ldquo;Yes&rdquo; here fails the whole audit
                (Band 0), regardless of the overall percentage.
              </CardDescription>            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {section.questions.map((q) => (
              <div key={q.key} className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-foreground sm:max-w-[70%]">{q.label}</p>
                <div className="flex gap-1.5">
                  {ANSWER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAnswer(q.key, opt.value)}
                      className={
                        "h-8 rounded-md border px-3 text-xs font-medium transition-colors " +
                        (answers[q.key] === opt.value
                          ? opt.value === "no"
                            ? "border-danger bg-danger/10 text-danger"
                            : "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-border bg-card text-muted-foreground hover:bg-muted")
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Overall remarks (optional)</CardTitle>
          <CardDescription>Visible only to Leads/Managers — never shown to the audited agent.</CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={overallRemarks}
            onChange={(e) => setOverallRemarks(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-input bg-card p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Context, evidence, or coaching notes for this audit…"
          />
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" /> Submit audit
          </>
        )}
      </Button>
    </div>
  );
}

function AuditDetail({ audit }: { audit: QaAuditRecord }) {
  const definition = getAuditDefinition(audit.auditType);
  const answerByKey = new Map(audit.answers.map((a) => [a.questionKey, a.value]));
  return (
    <div className="space-y-3 border-t border-border pt-3">
      {definition.sections.map((section) => (
        <div key={section.key}>
          <p className="text-xs font-semibold uppercase text-muted-foreground">{section.title}</p>
          <ul className="mt-1 space-y-1">
            {section.questions.map((q) => {
              const value = answerByKey.get(q.key);
              return (
                <li key={q.key} className="flex items-start justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">{q.label}</span>
                  <span
                    className={
                      "flex-shrink-0 font-medium " +
                      (value === "no" ? "text-danger" : value === "yes" ? "text-success" : "text-muted-foreground")
                    }
                  >
                    {value === "yes" ? "Yes" : value === "no" ? "No" : "N/A"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {audit.overallRemarks && (
        <div className="rounded-md bg-muted/40 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Overall remarks</p>
          <p className="mt-1 text-xs text-foreground">{audit.overallRemarks}</p>
        </div>
      )}
    </div>
  );
}

function AuditHistory({ auditType }: { auditType: QaAuditType }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [audits, setAudits] = React.useState<QaAuditRecord[] | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [publishingId, setPublishingId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<QaAuditRecord | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/qa-audits?type=${auditType}`);
    const data = await res.json();
    setAudits(res.ok ? data.audits : []);
  }, [auditType]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function publish(audit: QaAuditRecord) {
    setPublishingId(audit.id);
    try {
      const res = await fetch(`/api/qa-audits/${audit.id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Failed to publish.", "error");
        return;
      }
      if (data.blendedQaAuditPct !== null && data.blendedQaAuditPct !== undefined) {
        showToast(`Published — this agent's QA Audit % for ${audit.periodLabel} is now ${data.blendedQaAuditPct}%.`, "success");
      } else {
        showToast(data.message ?? "Published.", "success");
      }
      await load();
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unexpected error.", "error");
    } finally {
      setPublishingId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/qa-audits/${pendingDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Failed to delete.", "error");
        return;
      }
      showToast("Audit deleted.", "success");
      setPendingDelete(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unexpected error.", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (audits === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading audits…
      </p>
    );
  }
  if (audits.length === 0) {
    return <p className="text-sm text-muted-foreground">No audits submitted yet.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {audits.map((audit) => (
          <li key={audit.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {audit.agentName} · {audit.periodLabel}
                </p>
                <p className="text-xs text-muted-foreground">
                  Audited {formatDate(audit.auditDate)} by {audit.auditorName}
                  {audit.caseReference ? ` · ${audit.caseReference}` : ""}
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                <Badge variant={bandBadgeVariant(audit.band)}>
                  {audit.percentage !== null ? `${audit.percentage.toFixed(1)}%` : "No data"} · Band {audit.band ?? "—"}
                </Badge>
                {audit.autoFail && <Badge variant="danger">Auto-Fail</Badge>}
                <Badge variant={audit.status === "published" ? "success" : "outline"}>{audit.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => window.open(`/api/qa-audits/${audit.id}/pdf`, "_blank")}>
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
                <Button size="sm" onClick={() => publish(audit)} disabled={publishingId === audit.id}>
                  {publishingId === audit.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : audit.status === "published" ? "Re-publish" : "Publish"}
                </Button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(audit)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                  aria-label="Delete audit"
                  title="Delete this audit"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === audit.id ? null : audit.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                  aria-label="Toggle detail"
                >
                  {expandedId === audit.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {expandedId === audit.id && <AuditDetail audit={audit} />}
          </li>
        ))}
      </ul>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
        title="Delete this audit?"
        description="This removes the audit record permanently. If it was already published, the scorecard's QA Audit % it contributed to is NOT automatically recalculated — publish another remaining audit for that agent/period afterward to refresh it."
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </>
        }
      />
    </>
  );
}

export function QaAuditPanel({ auditType, agents, periods }: { auditType: QaAuditType; agents: AgentOption[]; periods: PeriodOption[] }) {
  const [tab, setTab] = React.useState("submit");

  if (agents.length === 0 || periods.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4" /> Import at least one period of data first — audits count toward an existing period.
      </p>
    );
  }

  return (
    <Tabs value={tab} onValueChange={setTab} defaultValue="submit">
      <TabsList>
        <TabsTrigger value="submit">Submit New</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="submit" className="mt-4">
        <SubmitAuditForm auditType={auditType} agents={agents} periods={periods} onSubmitted={() => setTab("history")} />
      </TabsContent>
      <TabsContent value="history" className="mt-4">
        <AuditHistory auditType={auditType} />
      </TabsContent>
    </Tabs>
  );
}
