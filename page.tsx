import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { RecognitionBoard } from "@/components/rankings/RecognitionBoard";
import { EmptyState } from "@/components/shared/EmptyState";
import { loadPeriodDataset } from "@/lib/data/query";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getUnlockedAgentIds } from "@/lib/auth/recordUnlock";

export default async function RankingsPage() {
  const [{ period, ranked }, user, unlockedAgentIds] = await Promise.all([
    loadPeriodDataset(),
    getCurrentUser(),
    getUnlockedAgentIds(),
  ]);

  if (!period || ranked.length === 0) {
    return (
      <>
        <TopHeader title="Rankings" description="Top performers & coaching opportunities" />
        <PageShell>
          <EmptyState title="No rankings yet" actionLabel="Import a report" actionHref="/import" />
        </PageShell>
      </>
    );
  }

  const topFive = ranked.slice(0, 5);
  // Leave a gap rather than double-counting anyone as both a Top 5 and
  // Bottom 5 pick when the roster is small (10 or fewer scored agents).
  const bottomCount = Math.max(0, Math.min(5, ranked.length - topFive.length));
  const bottomFive = bottomCount > 0 ? [...ranked.slice(-bottomCount)].reverse() : [];

  return (
    <>
      <TopHeader title="Rankings" description={`Top performers & coaching opportunities — ${period.label}`} />
      <PageShell>
        <RecognitionBoard
          topFive={topFive}
          bottomFive={bottomFive}
          totalAgents={ranked.length}
          isLead={user?.role === "lead"}
          unlockedAgentIds={unlockedAgentIds}
        />
      </PageShell>
    </>
  );
}
