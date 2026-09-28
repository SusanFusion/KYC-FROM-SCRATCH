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

// A soft corner-lit gradient wash plus a matching colored ambient shadow —
// the "emphasized" whole-tile look, elegant enough to read at a glance
// across the room without turning a grid of these into a wall of solid
// color (first shipped on Team Performance, then rolled out everywhere
// color-coded tiles appear, per Susan's request). Exported so a page that
// builds its own color-coded block OUTSIDE MetricBlockCard -- e.g. Team
// Performance's and Overall MTD's Gate Multiplier hero band, which isn't a
// metric tile -- can match the exact same finish instead of duplicating it.
export const TONE_GRADIENT: Record<Tone, string> = {
  primary:
    "border-primary/25 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent shadow-[0_10px_28px_-12px_hsl(var(--primary)/0.50)] hover:shadow-[0_16px_36px_-10px_hsl(var(--primary)/0.55)]",
  success:
    "border-success/25 bg-gradient-to-br from-success/20 via-success/5 to-transparent shadow-[0_10px_28px_-12px_hsl(var(--success)/0.45)] hover:shadow-[0_16px_36px_-10px_hsl(var(--success)/0.50)]",
  warning:
    "border-warning/25 bg-gradient-to-br from-warning/20 via-warning/5 to-transparent shadow-[0_10px_28px_-12px_hsl(var(--warning)/0.45)] hover:shadow-[0_16px_36px_-10px_hsl(var(--warning)/0.50)]",
  danger:
    "border-danger/25 bg-gradient-to-br from-danger/20 via-danger/5 to-transparent shadow-[0_10px_28px_-12px_hsl(var(--danger)/0.45)] hover:shadow-[0_16px_36px_-10px_hsl(var(--danger)/0.50)]",
  // "No data" tone — a quiet neutral wash, no colored glow (nothing to
  // highlight).
  muted: "border-border bg-gradient-to-br from-muted/30 via-muted/10 to-transparent",
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
  emphasized = false,
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
  /** true = tint the whole tile with the tone-colored gradient + ambient
   *  shadow (see TONE_GRADIENT) — a calmer, wider signal than the default
   *  thin top-border accent. Off by default so a page that hasn't opted in
   *  keeps its current look. */
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-popover/40",
        emphasized ? TONE_GRADIENT[tone] : cn("border-t-4 border-border bg-card", TONE_BORDER[tone]),
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
