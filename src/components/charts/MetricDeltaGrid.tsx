import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface MetricDeltaDatum {
  key: string;
  name: string;
  currentDisplay: string;
  /** null when there's no earlier period to compare against yet. */
  previousDisplay: string | null;
  /** Signed, human-readable magnitude, e.g. "1.2 min", "3.5s", "2.1 pts".
   *  null when there's nothing to compare (no previous period, or one side
   *  has no data this period). */
  deltaLabel: string | null;
  /** true = this metric moved in the direction that counts as better for it
   *  (already direction-aware — a drop in AHT and a rise in CSAT both read
   *  as true); false = moved the wrong way; null = flat / not comparable. */
  improved: boolean | null;
}

/**
 * "Before vs after, per item" — a KPI row of compact tiles rather than one
 * crowded multi-line chart. Six metrics in different units (minutes,
 * seconds, percent) can't honestly share one axis, and six lines on one
 * chart is well past the point of being easy to read at a glance. Each tile
 * carries its own current value, what it was last period, and a single
 * status-colored delta — the reader gets the same "went up / went down /
 * held steady" story per metric without the eye having to untangle series.
 */
export function MetricDeltaGrid({ data }: { data: MetricDeltaDatum[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((m) => (
        <div key={m.key} className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{m.name}</p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-xl font-semibold text-foreground">{m.currentDisplay}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {m.previousDisplay ? `was ${m.previousDisplay}` : "no prior period yet"}
            </span>
            {m.deltaLabel && (
              <Badge variant={m.improved === true ? "success" : m.improved === false ? "danger" : "outline"}>
                {m.improved === null ? (
                  <Minus className="h-3 w-3" />
                ) : m.improved ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {m.deltaLabel}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Shared tone so the hero "team average" delta badge matches these tiles. */
export function deltaBadgeVariant(improved: boolean | null): "success" | "danger" | "outline" {
  return improved === true ? "success" : improved === false ? "danger" : "outline";
}
