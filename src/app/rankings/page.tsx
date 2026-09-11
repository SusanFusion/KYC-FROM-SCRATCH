import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { RankingTable, type RankingRow } from "@/components/rankings/RankingTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { loadPeriodDataset } from "@/lib/data/query";

export default async function RankingsPage() {
  const { period, ranked, teams } = await loadPeriodDataset();

  if (!period) {
    return (
      <>
        <TopHeader title="Rankings" description="Leaderboard across the team" />
        <PageShell>
          <EmptyState title="No rankings yet" actionLabel="Import a report" actionHref="/import" />
        </PageShell>
      </>
    );
  }

  const rows: RankingRow[] = ranked.map((r) => ({
    agentId: r.agent.id,
    name: r.agent.name,
    department: r.agent.department,
    finalScore: r.individual.finalScore,
    totalBonusPhp: r.bonus.totalBonusPhp,
    isTopPerformer: r.bonus.isTopPerformer,
    hasIncompleteData: r.individual.hasIncompleteData,
    appAHT: r.individual.metrics.find((m) => m.key === "appAHT")?.actualDisplay ?? "—",
    emailAHT: r.individual.metrics.find((m) => m.key === "emailAHT")?.actualDisplay ?? "—",
    chatAvgResponse: r.individual.metrics.find((m) => m.key === "chatAvgResponse")?.actualDisplay ?? "—",
    csatDsat: r.individual.metrics.find((m) => m.key === "csatDsat")?.actualDisplay ?? "—",
  }));

  return (
    <>
      <TopHeader title="Rankings" description={`Leaderboard for ${period.label}`} />
      <PageShell>
        <Card>
          <CardContent className="p-5">
            <RankingTable rows={rows} departments={teams.map((t) => t.name)} />
          </CardContent>
        </Card>
      </PageShell>
    </>
  );
}
