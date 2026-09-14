import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { RankingTable, type RankingRow } from "@/components/rankings/RankingTable";
import { TopPerformersSpotlight } from "@/components/rankings/TopPerformersSpotlight";
import { EncouragementBand } from "@/components/rankings/EncouragementBand";
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
    hasIncompleteData: r.individual.hasIncompleteData,
    appAHT: r.individual.metrics.find((m) => m.key === "appAHT")?.actualDisplay ?? "—",
    emailAHT: r.individual.metrics.find((m) => m.key === "emailAHT")?.actualDisplay ?? "—",
    chatAvgResponse: r.individual.metrics.find((m) => m.key === "chatAvgResponse")?.actualDisplay ?? "—",
    chatFRT: r.individual.metrics.find((m) => m.key === "chatFRT")?.actualDisplay ?? "—",
    csatDsat: r.individual.metrics.find((m) => m.key === "csatDsat")?.actualDisplay ?? "—",
  }));

  // Top 3 and "room to grow" 3 are always disjoint: the latter is only
  // drawn from whatever's left after the top 3, and only shown at all once
  // there are enough agents for the two groups not to overlap.
  const toSpotlightAgent = (r: RankingRow) => ({ agentId: r.agentId, name: r.name, department: r.department, score: r.finalScore });
  const topThree = rows.slice(0, 3).map(toSpotlightAgent);
  const growCount = Math.min(3, Math.max(0, rows.length - 3));
  const roomToGrow = (growCount > 0 ? rows.slice(-growCount) : []).map(toSpotlightAgent);

  return (
    <>
      <TopHeader title="Rankings" description={`Leaderboard for ${period.label}`} />
      <PageShell>
        <TopPerformersSpotlight agents={topThree} />

        <Card className="mt-4">
          <CardContent className="p-5">
            <RankingTable rows={rows} departments={teams.map((t) => t.name)} />
          </CardContent>
        </Card>

        <div className="mt-4">
          <EncouragementBand agents={roomToGrow} />
        </div>
      </PageShell>
    </>
  );
}
