import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Tone } from "@/components/dashboard/PerformanceBadge";

const TONE_BORDER: Record<Tone, string> = {
  primary: "border-t-primary",
  success: "border-t-success",
  warning: "border-t-warning",
  danger: "border-t-danger",
  muted: "border-t-border",
};

/**
 * One "block" tile for a single metric: label, big value, status badge, and
 * an optional buffer/margin caption (e.g. "5.2s under" the Amber threshold).
 * Used for the Business Gate metrics, Individual Scorecard metrics, and
 * top-level dashboard KPIs — anywhere a scoring-scale table is paired with
 * a data grid.
 */
export function MetricBlockCard({
  label,
  value,
  badge,
  tone,
  weightLabel,
  bufferLabel,
  bufferGood,
  tooltip,
  className,
}: {
  label: string;
  value: string;
  badge: ReactNode;
  tone: Tone;
  weightLabel?: string;
  bufferLabel?: string | null;
  bufferGood?: boolean | null;
  tooltip?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-t-4 border-border bg-card p-4 shadow-card transition-shadow hover:shadow-popover/40",
        TONE_BORDER[tone],
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        {tooltip && (
          <Tooltip label={tooltip}>
            <HelpCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Tooltip>
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold leading-tight text-foreground">{value}</div>
      <div className="mt-2">{badge}</div>
      {bufferLabel && (
        <p className={cn("mt-1.5 text-xs", bufferGood === false ? "text-danger" : "text-muted-foreground")}>{bufferLabel}</p>
      )}
      {weightLabel && <p className="mt-1 text-[11px] text-muted-foreground">{weightLabel}</p>}
    </div>
  );
}
