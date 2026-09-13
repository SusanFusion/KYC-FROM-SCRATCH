import { Crown, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

const MEDAL_STYLES: Record<
  1 | 2 | 3,
  { bg: string; ring: string; icon: typeof Crown; iconColor: string; glow: string }
> = {
  1: {
    bg: "bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500",
    ring: "ring-2 ring-amber-300/70",
    icon: Crown,
    iconColor: "text-amber-900",
    glow: "shadow-[0_0_18px_-2px_rgba(245,158,11,0.65)]",
  },
  2: {
    bg: "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400",
    ring: "ring-2 ring-slate-300/70",
    icon: Medal,
    iconColor: "text-slate-700",
    glow: "shadow-[0_0_14px_-2px_rgba(148,163,184,0.6)]",
  },
  3: {
    bg: "bg-gradient-to-br from-orange-300 via-orange-400 to-orange-600",
    ring: "ring-2 ring-orange-300/70",
    icon: Medal,
    iconColor: "text-orange-950",
    glow: "shadow-[0_0_14px_-2px_rgba(251,146,60,0.6)]",
  },
};

const DIM: Record<"sm" | "md" | "lg", string> = { sm: "h-6 w-6", md: "h-8 w-8", lg: "h-12 w-12" };
const ICON_DIM: Record<"sm" | "md" | "lg", string> = { sm: "h-3 w-3", md: "h-4 w-4", lg: "h-6 w-6" };
const TEXT_DIM: Record<"sm" | "md" | "lg", string> = { sm: "text-[10px]", md: "text-xs", lg: "text-sm" };

/**
 * Ranks 1–3 get a distinctive gold/silver/bronze medal with a glow and a
 * looping shine sweep (see .rank-shine in globals.css); everything else
 * falls back to a plain numbered circle.
 */
export function RankMedal({ rank, size = "md" }: { rank: number; size?: "sm" | "md" | "lg" }) {
  if (rank === 1 || rank === 2 || rank === 3) {
    const s = MEDAL_STYLES[rank];
    const Icon = s.icon;
    return (
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full",
          DIM[size],
          s.bg,
          s.ring,
          s.glow
        )}
      >
        <span className="rank-shine" aria-hidden="true" />
        <Icon className={cn(ICON_DIM[size], s.iconColor)} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground",
        DIM[size],
        TEXT_DIM[size]
      )}
    >
      {rank}
    </span>
  );
}
