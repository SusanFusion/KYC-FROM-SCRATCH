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
    // Distinct from hasIncompleteData (which is also true when only SOME
    // metrics are missing, e.g. QA Audit isn't measured yet): this is true
    // only when the agent has no data at all for this period — no import
    // row yet. Used to show a plain "No data" badge instead of a 0.00 score
    // that would otherwise look like a genuine failing grade.
    hasNoData: r.individual.effectiveWeight === 0,
    appAHT: r.individual.metrics.find((m) => m.key === "appAHT")?.actualDisplay ?? "—",
    emailAHT: r.individual.metrics.find((m) => m.key === "emailAHT")?.actualDisplay ?? "—",
    chatAvgResponse: r.individual.metrics.find((m) => m.key === "chatAvgResponse")?.actualDisplay ?? "—",
    chatFRT: r.individual.metrics.find((m) => m.key === "chatFRT")?.actualDisplay ?? "—",
    csatDsat: r.individual.metrics.find((m) => m.key === "csatDsat")?.actualDisplay ?? "—",
  }));

  // Top 3 and "room to grow" 3 only ever draw from agents who actually have
  // data this period — an agent with no import yet has a 0.00 placeholder
  // score that would otherwise wrongly land them in "Room to Grow" (or, on
  // a very sparse period, even "Top Performers"). They still show up in the
  // full table below either way. The two groups are otherwise disjoint: the
  // "room to grow" 3 are only drawn from whatever's left after the top 3.
  const scoredRows = rows.filter((r) => !r.hasNoData);
  const toSpotlightAgent = (r: RankingRow) => ({ agentId: r.agentId, name: r.name, department: r.department, score: r.finalScore });
  const topThree = scoredRows.slice(0, 3).map(toSpotlightAgent);
  const growCount = Math.min(3, Math.max(0, scoredRows.length - 3));
  const roomToGrow = (growCount > 0 ? scoredRows.slice(-growCount) : []).map(toSpotlightAgent);

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
