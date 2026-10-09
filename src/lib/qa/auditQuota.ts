import type { QaAuditRecord, QaAuditType } from "@/lib/qa/auditDefinitions";

// How many audits every agent is expected to receive each calendar month.
// Change a number here and the progress bars on the QA / Quality page follow.
export const AUDIT_QUOTA: Record<QaAuditType, number> = {
  chats: 2,
  emails: 2,
  applications: 8,
};

// The order the three audit types are shown in on the progress bars.
export const AUDIT_QUOTA_ORDER: QaAuditType[] = ["chats", "emails", "applications"];

export const AUDIT_QUOTA_TOTAL = AUDIT_QUOTA_ORDER.reduce((sum, t) => sum + AUDIT_QUOTA[t], 0);

export const AUDIT_QUOTA_LABELS: Record<QaAuditType, string> = {
  chats: "Chats",
  emails: "Emails",
  applications: "Applications",
};

/** Fired on `window` whenever an audit is created, edited or deleted, so the
 *  progress bars can reload without a page refresh. */
export const QA_AUDITS_CHANGED_EVENT = "kyc-qa-audits-changed";

export function notifyQaAuditsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(QA_AUDITS_CHANGED_EVENT));
}

/** "YYYY-MM" of an audit's date -- the calendar month it counts toward. */
export function auditMonthKey(audit: Pick<QaAuditRecord, "auditDate">): string {
  return audit.auditDate.slice(0, 7);
}

export interface AgentQuotaProgress {
  agentId: string;
  agentName: string;
  /** Audits actually done, per type (can exceed the quota). */
  done: Record<QaAuditType, number>;
  /** Audits that count toward the quota, per type (never above it). */
  counted: Record<QaAuditType, number>;
  countedTotal: number;
  complete: boolean;
}

/** One agent's progress for one calendar month. Audits beyond the quota are
 *  still shown in `done`, but don't push the bar past 100%. */
export function buildAgentProgress(
  agent: { id: string; name: string },
  audits: QaAuditRecord[],
  monthKey: string
): AgentQuotaProgress {
  const done: Record<QaAuditType, number> = { chats: 0, emails: 0, applications: 0 };
  for (const a of audits) {
    if (a.agentId !== agent.id || auditMonthKey(a) !== monthKey) continue;
    if (a.auditType in done) done[a.auditType] += 1;
  }
  const counted: Record<QaAuditType, number> = {
    chats: Math.min(done.chats, AUDIT_QUOTA.chats),
    emails: Math.min(done.emails, AUDIT_QUOTA.emails),
    applications: Math.min(done.applications, AUDIT_QUOTA.applications),
  };
  const countedTotal = counted.chats + counted.emails + counted.applications;
  return {
    agentId: agent.id,
    agentName: agent.name,
    done,
    counted,
    countedTotal,
    complete: countedTotal === AUDIT_QUOTA_TOTAL,
  };
}
