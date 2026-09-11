import Link from "next/link";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgentSearch } from "@/components/scorecard/AgentSearch";
import { loadPeriodDataset } from "@/lib/data/query";
import { formatPhp, initials } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";

export default async function ScorecardsPage() {
  const { period, ranked } = await loadPeriodDataset();

  if (!period) {
    return (
      <>
        <TopHeader title="Individual Scorecards" description="Per-agent performance breakdown" />
        <PageShell>
          <EmptyState title="No agents scored yet" actionLabel="Import a report" actionHref="/import" />
        </PageShell>
      </>
    );
  }

  return (
    <>
      <TopHeader
        title="Individual Scorecards"
        description={`${ranked.length} agents · ${period.label}`}
        actions={<AgentSearch agents={ranked.map((r) => ({ id: r.agent.id, name: r.agent.name }))} />}
      />
      <PageShell>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map((r, i) => (
            <Link key={r.agent.id} href={`/scorecards/${r.agent.id}`}>
              <Card className="h-full cursor-pointer">
                <CardContent className="flex items-start gap-3 p-5">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700">
                    {initials(r.agent.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{r.agent.name}</p>
                      <span className="text-xs text-muted-foreground">#{i + 1}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.agent.department}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-lg font-semibold text-foreground">{r.individual.finalScore.toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground">/ 3.00</span>
                      {r.individual.hasIncompleteData && <Badge variant="outline">Incomplete</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatPhp(r.bonus.totalBonusPhp)} bonus</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </PageShell>
    </>
  );
}
