"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { getLocalTodayIso } from "@/lib/utils";
import type { QaAuditRecord, QaAuditType } from "@/lib/qa/auditDefinitions";
import {
  AUDIT_QUOTA,
  AUDIT_QUOTA_LABELS,
  AUDIT_QUOTA_ORDER,
  AUDIT_QUOTA_TOTAL,
  QA_AUDITS_CHANGED_EVENT,
  auditMonthKey,
  buildAgentProgress,
  type AgentQuotaProgress,
} from "@/lib/qa/auditQuota";

interface AgentOption {
  id: string;
  name: string;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function fillClass(done: number, target: number): string {
  if (done >= target) return "bg-success";
  if (done === 0) return "bg-muted-foreground/30";
  return "bg-primary-500";
}

/** A thin accessible progress bar. The number next to it carries the same
 *  information, so the colour is never the only signal. */
function Bar({ done, target, label, tall = false }: { done: number; target: number; label: string; tall?: boolean }) {
  const pct = target === 0 ? 0 : Math.min(100, Math.round((done / target) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={Math.min(done, target)}
      className={(tall ? "h-2.5" : "h-1.5") + " w-full overflow-hidden rounded-full bg-muted"}
    >
      <div className={"h-full rounded-full transition-all " + fillClass(done, target)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function AgentTile({ p }: { p: AgentQuotaProgress }) {
  return (
    <li className={"rounded-lg border p-3 " + (p.complete ? "border-success/40 bg-success/5" : "border-border bg-card")}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-foreground">{p.agentName}</p>
        {p.complete ? (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> Complete
          </Badge>
        ) : (
          <span className="flex-shrink-0 text-xs font-semibold tabular-nums text-foreground">
            {p.countedTotal}/{AUDIT_QUOTA_TOTAL}
          </span>
        )}
      </div>
      <div className="mt-2">
        <Bar done={p.countedTotal} target={AUDIT_QUOTA_TOTAL} label={`${p.agentName}: ${p.countedTotal} of ${AUDIT_QUOTA_TOTAL} audits`} tall />
      </div>
      <ul className="mt-3 space-y-2">
        {AUDIT_QUOTA_ORDER.map((type) => {
          const target = AUDIT_QUOTA[type];
          const done = p.done[type];
          return (
            <li key={type}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{AUDIT_QUOTA_LABELS[type]}</span>
                <span className={"font-medium tabular-nums " + (done >= target ? "text-success" : "text-foreground")}>
                  {done}/{target}
                  {done > target ? " (extra)" : ""}
                </span>
              </div>
              <div className="mt-1">
                <Bar done={done} target={target} label={`${p.agentName} ${AUDIT_QUOTA_LABELS[type]} audits: ${done} of ${target}`} />
              </div>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

/**
 * Monthly audit completion per agent: every agent should receive 2 chat
 * audits, 2 email audits and 8 application audits (see AUDIT_QUOTA). Counts
 * every audit saved in that calendar month by its audit date -- submitted or
 * published, it is still an audit that was done. Only ever rendered inside the
 * Lead/Manager password gate, because the audit records come from the
 * password-protected /api/qa-audits route.
 */
export function AuditProgress({ agents }: { agents: AgentOption[] }) {
  const [audits, setAudits] = React.useState<QaAuditRecord[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [month, setMonth] = React.useState(() => getLocalTodayIso().slice(0, 7));
  const [onlyIncomplete, setOnlyIncomplete] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/qa-audits", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { audits?: QaAuditRecord[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Couldn't load the audits.");
        setAudits([]);
        return;
      }
      setError(null);
      setAudits(data.audits ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the audits.");
      setAudits([]);
    }
  }, []);

  React.useEffect(() => {
    load();
    window.addEventListener(QA_AUDITS_CHANGED_EVENT, load);
    return () => window.removeEventListener(QA_AUDITS_CHANGED_EVENT, load);
  }, [load]);

  const currentMonth = getLocalTodayIso().slice(0, 7);
  const monthOptions = React.useMemo(() => {
    const keys = new Set<string>([currentMonth]);
    for (const a of audits ?? []) keys.add(auditMonthKey(a));
    return [...keys].filter((k) => /^\d{4}-\d{2}$/.test(k)).sort().reverse();
  }, [audits, currentMonth]);

  const progress = React.useMemo(() => {
    const rows = agents.map((a) => buildAgentProgress(a, audits ?? [], month));
    // Furthest from done first, so the people who still need audits are on top.
    return rows.sort((a, b) => a.countedTotal - b.countedTotal || a.agentName.localeCompare(b.agentName));
  }, [agents, audits, month]);

  const completeCount = progress.filter((p) => p.complete).length;
  const countedAll = progress.reduce((sum, p) => sum + p.countedTotal, 0);
  const targetAll = progress.length * AUDIT_QUOTA_TOTAL;
  const perType = AUDIT_QUOTA_ORDER.map((type) => ({
    type,
    done: progress.reduce((sum, p) => sum + p.counted[type], 0),
    target: progress.length * AUDIT_QUOTA[type],
  }));
  const shown = onlyIncomplete ? progress.filter((p) => !p.complete) : progress;

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="audit-progress-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="audit-progress-title" className="text-sm font-semibold tracking-tight text-foreground">
            Audit completion by agent
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Each agent should have {AUDIT_QUOTA.chats} chat, {AUDIT_QUOTA.emails} email and {AUDIT_QUOTA.applications} application audits per month,
            counted by audit date.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="audit-progress-month" className="mb-1 block text-xs font-medium text-muted-foreground">
              Month
            </label>
            <Select id="audit-progress-month" value={month} onChange={(e) => setMonth(e.target.value)}>
              {monthOptions.includes(month) ? null : <option value={month}>{monthLabel(month)}</option>}
              {monthOptions.map((k) => (
                <option key={k} value={k}>
                  {monthLabel(k)}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex h-9 cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
            <input type="checkbox" checked={onlyIncomplete} onChange={(e) => setOnlyIncomplete(e.target.checked)} className="h-4 w-4 rounded border-input" />
            Only show incomplete
          </label>
        </div>
      </div>

      {audits === null ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading audit progress…
        </p>
      ) : (
        <>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          {progress.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No active agents to show.</p>
          ) : (
            <>
              <div className="mt-4 rounded-lg bg-muted/40 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    Team — {monthLabel(month)}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {completeCount} of {progress.length} agent{progress.length === 1 ? "" : "s"} complete
                    </span>
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {countedAll}/{targetAll} audits
                  </p>
                </div>
                <div className="mt-2">
                  <Bar done={countedAll} target={targetAll} label={`Team: ${countedAll} of ${targetAll} audits`} tall />
                </div>
                <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {perType.map((t) => (
                    <li key={t.type}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{AUDIT_QUOTA_LABELS[t.type as QaAuditType]}</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {t.done}/{t.target}
                        </span>
                      </div>
                      <div className="mt-1">
                        <Bar done={t.done} target={t.target} label={`Team ${AUDIT_QUOTA_LABELS[t.type as QaAuditType]} audits: ${t.done} of ${t.target}`} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {shown.length === 0 ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" /> Everyone has all of their audits for {monthLabel(month)}.
                </p>
              ) : (
                <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {shown.map((p) => (
                    <AgentTile key={p.agentId} p={p} />
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
