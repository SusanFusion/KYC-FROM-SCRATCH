import Link from "next/link";
import { Trophy } from "lucide-react";
import { RankMedal } from "@/components/rankings/RankMedal";
import { TopThreeConfetti } from "@/components/rankings/TopThreeConfetti";
import { cn } from "@/lib/utils";

export interface SpotlightAgent {
  agentId: string;
  name: string;
  department: string;
  score: number;
}

// The same gold/silver/bronze row wash RankingTable and the Dashboard's own
// top-3 rows use (see globals.css .rank-row-*, and RankingTable.tsx's
// ROW_TINT) rather than the literal amber-50/slate-50/orange-50 Tailwind
// colors this used to hardcode. Those stayed pale in dark mode while
// text-foreground/text-muted-foreground correctly turned near-white,
// washing every card out to the point of being unreadable. .rank-row-* is
// an rgba wash with its own .dark override (turning the opacity UP rather
// than flipping a fixed light color), so it stays a faint, on-brand tint in
// both themes -- the border is the plain theme-adaptive border-border
// instead of a matching tinted border, since the medal icon above already
// carries the gold/silver/bronze distinction.
const CARD_STYLE: Record<1 | 2 | 3, string> = {
  1: "rank-row-gold",
  2: "rank-row-silver",
  3: "rank-row-bronze",
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
      <TopThreeConfetti />
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
              data-podium-rank={rank}
              href={`/scorecards/${a.agentId}`}
              className={cn(
                "flex flex-1 flex-col items-center rounded-lg border border-border p-5 text-center shadow-card transition-transform hover:-translate-y-0.5 sm:max-w-[220px]",
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
