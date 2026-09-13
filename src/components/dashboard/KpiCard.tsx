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

const TONE_ICON: Record<Tone, string> = {
  primary: "bg-primary-50 text-primary-600",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
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
    <Card className={cn("animate-slide-up overflow-hidden border-t-4 bg-gradient-to-br to-transparent", TONE_BORDER[tone], TONE_WASH[tone])}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          {Icon && (
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-md transition-transform", TONE_ICON[tone])}>
              <Icon className="h-4 w-4" />
            </span>
          )}
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
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
