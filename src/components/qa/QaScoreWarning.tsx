"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACTION_ACCESS_EVENT } from "@/lib/auth/actionAccessEvents";
import { QA_AUDITS_CHANGED_EVENT } from "@/lib/qa/auditQuota";
import type { QaScoreIssue } from "@/lib/qa/scoreCheck";

/**
 * Lead-only warning banner: lists QA Audit scores that exist but are NOT
 * reflected in the scorecard for the period on screen, with a one-click
 * "Recalculate" for the ones that can be fixed in place.
 *
 * The check runs behind the Lead/Manager password (the route returns 401 to
 * anyone else), so agents and locked browsers simply never see it -- it
 * renders nothing and shows no hint it exists. It re-checks when the browser
 * is unlocked/locked and whenever an audit is created, edited or deleted.
 */

const MAX_SHOWN = 8;

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function QaScoreWarning({ start, end, agentId }: { start: string; end: string; agentId?: string }) {
  const router = useRouter();
  const [issues, setIssues] = React.useState<QaScoreIssue[]>([]);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const params = new URLSearchParams({ start, end });
      if (agentId) params.set("agentId", agentId);
      const res = await fetch(`/api/qa-audits/score-check?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        // 401 = not a Lead in this browser; anything else = just stay quiet.
        setIssues([]);
        return;
      }
      const data = (await res.json()) as { issues?: QaScoreIssue[] };
      setIssues(data.issues ?? []);
    } catch {
      setIssues([]);
    }
  }, [start, end, agentId]);

  React.useEffect(() => {
    load();
    window.addEventListener(ACTION_ACCESS_EVENT, load);
    window.addEventListener(QA_AUDITS_CHANGED_EVENT, load);
    return () => {
      window.removeEventListener(ACTION_ACCESS_EVENT, load);
      window.removeEventListener(QA_AUDITS_CHANGED_EVENT, load);
    };
  }, [load]);

  async function recalc(list: QaScoreIssue[], key: string) {
    setBusyKey(key);
    setMessage(null);
    let fixed = 0;
    let failed = 0;
    for (const issue of list) {
      try {
        const res = await fetch("/api/qa-audits/score-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: issue.agentId, periodId: issue.periodId }),
        });
        if (res.ok) fixed += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
    setBusyKey(null);
    setMessage(
      failed === 0
        ? `Recalculated ${plural(fixed, "score")}. The scorecard now includes it.`
        : `Recalculated ${fixed}; ${failed} could not be recalculated. Try Re-publish on the audit in QA Audits → History.`
    );
    await load();
    router.refresh();
  }

  if (issues.length === 0 && !message) return null;

  const notCalculated = issues.filter((i) => i.kind === "not_calculated");
  const notPublished = issues.filter((i) => i.kind === "not_published");
  const shown = issues.slice(0, MAX_SHOWN);

  return (
    <div role="alert" className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-semibold text-foreground">
              {issues.length > 0
                ? `QA Audit ${plural(issues.length, "score")} not included in this scorecard`
                : "QA Audit scores updated"}
            </p>
            {issues.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Visible to Leads only.
                {notCalculated.length > 0 && " Published audits whose score never reached the scorecard can be recalculated below."}
                {notPublished.length > 0 && " Submitted audits only count once they are published."}
              </p>
            )}
          </div>
        </div>
        {notCalculated.length > 1 && (
          <Button size="sm" variant="outline" disabled={busyKey !== null} onClick={() => recalc(notCalculated, "all")}>
            {busyKey === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Recalculate all
          </Button>
        )}
      </div>

      {message && <p className="mt-2 text-xs text-foreground">{message}</p>}

      {shown.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {shown.map((i) => {
            const key = `${i.kind}|${i.agentId}|${i.periodId}`;
            return (
              <li key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card/70 px-3 py-2">
                <span className="text-xs text-foreground">
                  <span className="font-semibold">{i.agentName}</span> · {prettyDate(i.date)} —{" "}
                  {i.kind === "not_calculated" ? (
                    <>
                      {plural(i.auditCount, "published audit")} average{i.auditCount === 1 ? "s" : ""} {i.expectedPct}%, but the scorecard{" "}
                      {i.currentPct === null ? "has no QA score" : `shows ${i.currentPct}%`}.
                    </>
                  ) : (
                    <>{plural(i.auditCount, "audit")} submitted but not published, so the score is not counted yet.</>
                  )}
                </span>
                {i.kind === "not_calculated" ? (
                  <Button size="sm" variant="outline" disabled={busyKey !== null} onClick={() => recalc([i], key)}>
                    {busyKey === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Recalculate
                  </Button>
                ) : (
                  <Link href="/qa-quality" className="text-xs font-medium text-primary hover:underline">
                    Open QA Audits →
                  </Link>
                )}
              </li>
            );
          })}
          {issues.length > shown.length && (
            <li className="px-1 text-xs text-muted-foreground">+ {issues.length - shown.length} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
