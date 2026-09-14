import Link from "next/link";
import { Lock, PartyPopper, HeartHandshake } from "lucide-react";
import { RankMedal } from "@/components/rankings/RankMedal";
import { GradeBadge } from "@/components/dashboard/PerformanceBadge";
import { Badge } from "@/components/ui/badge";
import { initials, cn } from "@/lib/utils";
import { celebrationFor, motivationFor } from "@/lib/rankings/recognition";
import type { AgentPeriodResult } from "@/lib/data/query";

const KPI_LABELS: Record<string, string> = {
  appAHT: "App AHT",
  emailAHT: "Email AHT",
  chatAvgResponse: "Chat Avg Response",
  chatFRT: "Chat First Response",
  csatDsat: "CSAT",
  qaAudit: "QA Audit",
};

function KpiMiniGrid({
  result,
  canSeeQa,
}: {
  result: AgentPeriodResult;
  canSeeQa: boolean;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-3">
      {result.individual.metrics.map((m) => {
        const locked = m.key === "qaAudit" && !canSeeQa;
        return (
          <div key={m.key} className="min-w-0">
            <dt className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
              {KPI_LABELS[m.key] ?? m.name}
            </dt>
            <dd className="truncate font-medium text-foreground">
              {locked ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Lock className="h-3 w-3" /> Locked
                </span>
              ) : (
                m.actualDisplay
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function TopFiveCard({
  result,
  rank,
  canSeeQa,
}: {
  result: AgentPeriodResult;
  rank: number;
  canSeeQa: boolean;
}) {
  return (
    <Link
      href={`/scorecards/${result.agent.id}`}
      className={cn(
        "recognition-pin group relative flex flex-col gap-3 rounded-xl border p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md",
        rank === 1
          ? "border-amber-300/70 bg-gradient-to-br from-amber-50 via-white to-amber-50"
          : "border-border bg-card"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <RankMedal rank={rank} size={rank === 1 ? "lg" : "md"} />
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
            {initials(result.agent.name)}
          </span>
        </div>
        <GradeBadge
          grade={(result.individual.finalScore >= 3 ? 3 : result.individual.finalScore >= 2 ? 2 : result.individual.finalScore >= 1 ? 1 : 0) as 0 | 1 | 2 | 3}
          label={result.individual.finalScore.toFixed(2)}
        />
      </div>
      <div>
        <p className="font-semibold text-foreground group-hover:underline">{result.agent.name}</p>
        <p className="mt-0.5 text-xs font-medium text-amber-700">{celebrationFor(rank - 1)}</p>
      </div>
      <KpiMiniGrid result={result} canSeeQa={canSeeQa} />
    </Link>
  );
}

function BottomFiveCard({
  result,
  index,
  canSeeQa,
}: {
  result: AgentPeriodResult;
  index: number;
  canSeeQa: boolean;
}) {
  return (
    <Link
      href={`/scorecards/${result.agent.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-sky-200/70 bg-sky-50/50 p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
          {initials(result.agent.name)}
        </span>
        <Badge variant="outline">{result.individual.finalScore.toFixed(2)} / 3.00</Badge>
      </div>
      <div>
        <p className="font-semibold text-foreground group-hover:underline">{result.agent.name}</p>
        <p className="mt-0.5 flex items-start gap-1.5 text-xs font-medium text-sky-700">
          <HeartHandshake className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          {motivationFor(index)}
        </p>
      </div>
      <KpiMiniGrid result={result} canSeeQa={canSeeQa} />
    </Link>
  );
}

export function RecognitionBoard({
  topFive,
  bottomFive,
  totalAgents,
  isLead,
  unlockedAgentIds,
}: {
  topFive: AgentPeriodResult[];
  bottomFive: AgentPeriodResult[];
  totalAgents: number;
  isLead: boolean;
  unlockedAgentIds: string[];
}) {
  const canSeeQa = (agentId: string) => isLead || unlockedAgentIds.includes(agentId);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-foreground">Top 5 This Period</h2>
        </div>
        <div className="recognition-board rounded-2xl border border-amber-200/60 bg-amber-50/40 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {topFive.map((r, i) => (
              <TopFiveCard key={r.agent.id} result={r} rank={i + 1} canSeeQa={canSeeQa(r.agent.id)} />
            ))}
          </div>
        </div>
      </section>

      {bottomFive.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-sky-500" />
            <h2 className="text-lg font-semibold text-foreground">Keep Growing — Bottom 5</h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Every period is a fresh start. These are coaching opportunities, not a call-out — share the love.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {bottomFive.map((r, i) => (
              <BottomFiveCard key={r.agent.id} result={r} index={i} canSeeQa={canSeeQa(r.agent.id)} />
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Showing the top {topFive.length} and bottom {bottomFive.length} of {totalAgents} scored agents this period.
        Full rankings for every agent are on each agent&apos;s own Scorecard.
      </p>
    </div>
  );
}
