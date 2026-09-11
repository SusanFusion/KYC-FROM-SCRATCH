import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  trend,
  trendLabel,
  trendGood,
  statusBadge,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon?: LucideIcon;
  trend?: number | null; // fraction, e.g. 0.048 for +4.8%
  trendLabel?: string;
  trendGood?: boolean;
  statusBadge?: ReactNode;
}) {
  const TrendIcon = trend === null || trend === undefined || trend === 0 ? Minus : trend > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Card className="animate-slide-up">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          {Icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-50 text-primary-600">
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
