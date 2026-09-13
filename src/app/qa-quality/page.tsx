import { Construction, CheckCircle2 } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INDIVIDUAL_METRICS } from "@/lib/scoring";

const ROADMAP_ITEMS = [
  "Review a much larger percentage of interactions — ideally 80%+.",
  "Automated screening that flags problems for human review, rather than humans reviewing everything.",
  "Real-time visibility into quality trends, not just month-end snapshots.",
];

export default function QaQualityPage() {
  const qaMetric = INDIVIDUAL_METRICS.find((m) => m.key === "qaAudit");

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
      </PageShell>
    </>
  );
}
