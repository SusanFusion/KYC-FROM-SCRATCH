import { Construction, CheckCircle2 } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PasswordGate } from "@/components/shared/PasswordGate";
import { QaAuditPanel } from "@/components/qa/QaAuditPanel";
import { INDIVIDUAL_METRICS } from "@/lib/scoring";
import { getRepository } from "@/lib/data/repository";

const ROADMAP_ITEMS = [
  "Review a much larger percentage of interactions — ideally 80%+.",
  "Automated screening that flags problems for human review, rather than humans reviewing everything.",
  "Real-time visibility into quality trends, not just month-end snapshots.",
];

export default async function QaQualityPage() {
  const qaMetric = INDIVIDUAL_METRICS.find((m) => m.key === "qaAudit");

  // Agents/periods are ordinary public data (already visible via Import and
  // every other page) — safe to fetch before the password gate below, same
  // as Data Import does for its own dropdowns. The audit RECORDS themselves
  // (answers/remarks) are never fetched here; QaAuditPanel only pulls those,
  // from a requireActionAccess()-protected API route, after the password
  // gate unlocks — see the CONFIDENTIALITY note on QaAuditRecord.
  const repo = await getRepository();
  const [agents, periods] = await Promise.all([repo.getAgents(), repo.getPeriods()]);
  const agentOptions = agents
    .filter((a) => a.status === "active")
    .map((a) => ({ id: a.id, name: a.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const periodOptions = periods.map((p) => ({ id: p.id, label: p.label, endDate: p.endDate }));

  return (
    <>
      <TopHeader title="QA / Quality" description="Layer 3 of the KPI framework — currently in planning and development" />
      <PageShell>
        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-warning/10 text-warning">
              <Construction className="h-5 w-5" />
            </span>
            <div>
              <CardTitle>QA &amp; Automation Roadmap</CardTitle>
              <CardDescription>
                This layer is a roadmap, not yet a live scoring mechanism — reproduced verbatim from the framework, not invented.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Reviewing one chat, eight applications, and one email per agent each month is the maximum manual quality
              review practical at current team size — but that sample is too small to be statistically representative
              of the hundreds or thousands of interactions each agent handles. Until quality measurement scales, the
              framework intentionally keeps QA Audits at a low 5% weight in the individual scorecard rather than
              relying on an unreliable sample for a big share of anyone&apos;s score.
            </p>
            <p className="mt-3 text-sm font-medium text-foreground">Where the team wants to get to:</p>
            <ul className="mt-2 space-y-2">
              {ROADMAP_ITEMS.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-500" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs italic text-muted-foreground">
              Updates to the QA Automation Roadmap will be discussed and communicated by the respective leads as
              further improvements are implemented.
            </p>
          </CardContent>
        </Card>

        {qaMetric && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Current QA Audits grading (live today)</CardTitle>
              <CardDescription>Weight: {(qaMetric.weight * 100).toFixed(0)}% of the individual scorecard.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {qaMetric.bands.map((b) => (
                  <div key={b.grade} className="rounded-md border border-border p-3 text-center">
                    <Badge variant={b.grade === 3 ? "primary" : b.grade === 2 ? "success" : b.grade === 1 ? "warning" : "danger"}>
                      Grade {b.grade}
                    </Badge>
                    <p className="mt-2 text-xs font-medium text-foreground">{b.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.min !== null ? `${b.min}%` : "0%"} – {b.max !== null ? `${b.max}%` : "100%"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Applications Quality Audit</CardTitle>
            <CardDescription>
              Submit and manage KYC Applications QA audits. Answers and remarks are confidential to Leads/Managers —
              only the resulting percentage ever reaches an agent&apos;s scorecard, once published, blended into the same
              QA Audit % shown above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordGate description="Enter the shared Lead/Manager password to submit, publish, or review Applications audits.">
              <QaAuditPanel auditType="applications" agents={agentOptions} periods={periodOptions} />
            </PasswordGate>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Chats Quality Audit</CardTitle>
            <CardDescription>
              Submit and manage KYC Chats QA audits. Answers and remarks are confidential to Leads/Managers — only the
              resulting percentage ever reaches an agent&apos;s scorecard, once published, blended into the same QA
              Audit % shown above. Unlike Applications, an &ldquo;N/A&rdquo; answer here is excluded from the score
              entirely — the total points shrink by one for every question marked N/A.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordGate description="Enter the shared Lead/Manager password to submit, publish, or review Chats audits.">
              <QaAuditPanel auditType="chats" agents={agentOptions} periods={periodOptions} />
            </PasswordGate>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Emails Quality Audit</CardTitle>
            <CardDescription>
              Submit and manage KYC Emails QA audits. Answers and remarks are confidential to Leads/Managers — only
              the resulting percentage ever reaches an agent&apos;s scorecard, once published, blended into the same
              QA Audit % shown above. Unlike Applications, an &ldquo;N/A&rdquo; answer here is excluded from the score
              entirely — the total points shrink by one for every question marked N/A.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordGate description="Enter the shared Lead/Manager password to submit, publish, or review Emails audits.">
              <QaAuditPanel auditType="emails" agents={agentOptions} periods={periodOptions} />
            </PasswordGate>
          </CardContent>
        </Card>
      </PageShell>
    </>
  );
}
