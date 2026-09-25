import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Tone } from "@/components/dashboard/PerformanceBadge";

const TONE_BORDER: Record<Tone, string> = {
  primary: "border-t-primary",
  success: "border-t-success",
  warning: "border-t-warning",
  danger: "border-t-danger",
  muted: "border-t-border",
};

// A small solid "chip" for the icon, colored to match the card's tone — a
// lot more eye-catching than a flat tint, without needing a different icon
// per tone. Muted stays a plain neutral chip since it has no color of its
// own to carry.
const TONE_ICON_CHIP: Record<Tone, string> = {
  primary: "bg-gradient-to-br from-primary to-primary-600 text-white shadow-md shadow-primary/30",
  success: "bg-gradient-to-br from-success to-success/70 text-white shadow-md shadow-success/30",
  warning: "bg-gradient-to-br from-warning to-warning/70 text-white shadow-md shadow-warning/30",
  danger: "bg-gradient-to-br from-danger to-danger/70 text-white shadow-md shadow-danger/30",
  muted: "bg-muted text-muted-foreground",
};

const TONE_WASH: Record<Tone, string> = {
  primary: "from-primary-50/70",
  success: "from-success/[0.06]",
  warning: "from-warning/[0.06]",
  danger: "from-danger/[0.06]",
  muted: "from-transparent",
};

export function KpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  trend,
  trendLabel,
  trendGood,
  statusBadge,
  tone = "muted",
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon?: LucideIcon;
  trend?: number | null; // fraction, e.g. 0.048 for +4.8%
  trendLabel?: string;
  trendGood?: boolean;
  statusBadge?: ReactNode;
  tone?: Tone;
}) {
  const TrendIcon = trend === null || trend === undefined || trend === 0 ? Minus : trend > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Card
      className={cn(
        "group animate-slide-up overflow-hidden border-t-4 bg-gradient-to-br to-transparent",
        TONE_BORDER[tone],
        TONE_WASH[tone]
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          {Icon && (
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3",
                TONE_ICON_CHIP[tone]
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
          )}
        </div>
        <div className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</div>
        <div className="mt-2 flex items-center gap-2">
          {trend !== undefined && trend !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                trendGood === false ? "text-danger" : trendGood === true ? "text-success" : "text-muted-foreground"
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {Math.abs(trend * 100).toFixed(1)}%
            </span>
          )}
          {trendLabel && <span className="text-xs text-muted-foreground">{trendLabel}</span>}
          {statusBadge}
        </div>
        {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}
