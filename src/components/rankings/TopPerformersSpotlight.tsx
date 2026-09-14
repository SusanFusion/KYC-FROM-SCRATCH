import Link from "next/link";
import { Trophy } from "lucide-react";
import { RankMedal } from "@/components/rankings/RankMedal";
import { cn } from "@/lib/utils";

export interface SpotlightAgent {
  agentId: string;
  name: string;
  department: string;
  score: number;
}

// Soft, low-opacity washes that echo RankMedal's gold/silver/bronze palette
// (see globals.css .rank-row-*) rather than solid color — meant to read as
// a light recognition card, not a loud banner.
const CARD_STYLE: Record<1 | 2 | 3, string> = {
  1: "border-amber-200/70 bg-gradient-to-b from-amber-50 to-amber-50/30",
  2: "border-slate-200/70 bg-gradient-to-b from-slate-50 to-slate-50/30",
  3: "border-orange-200/70 bg-gradient-to-b from-orange-50 to-orange-50/30",
};

const TAGLINE: Record<1 | 2 | 3, string> = {
  1: "Leading the team this period.",
  2: "Right on the leader's heels.",
  3: "Rounding out the podium in style.",
};

// Visually reorders the three cards into a podium (2nd, 1st, 3rd) on wider
// screens while the underlying data — and the tab order — stays 1st, 2nd,
// 3rd. Stacks back to plain rank order on narrow screens.
const PODIUM_ORDER: Record<1 | 2 | 3, string> = {
  1: "sm:order-2",
  2: "sm:order-1",
  3: "sm:order-3",
};

/**
 * A recognition board for this period's top 3 agents — sits above the full
 * Rankings table. Every agent (including these three) still appears in the
 * table below; this is purely a "take a bow" spotlight, not a separate
 * source of truth.
 */
export function TopPerformersSpotlight({ agents }: { agents: SpotlightAgent[] }) {
  if (agents.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="mb-5 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-foreground">Top Performers</h2>
      </div>
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-center">
        {agents.map((a, i) => {
          const rank = (i + 1) as 1 | 2 | 3;
          return (
            <Link
              key={a.agentId}
              href={`/scorecards/${a.agentId}`}
              className={cn(
                "flex flex-1 flex-col items-center rounded-lg border p-5 text-center shadow-card transition-transform hover:-translate-y-0.5 sm:max-w-[220px]",
                CARD_STYLE[rank],
                PODIUM_ORDER[rank],
                rank === 1 && "sm:pb-7 sm:pt-6"
              )}
            >
              <RankMedal rank={rank} size="lg" />
              <p className="mt-3 max-w-full truncate text-sm font-semibold text-foreground">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.department}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{a.score.toFixed(2)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{TAGLINE[rank]}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
