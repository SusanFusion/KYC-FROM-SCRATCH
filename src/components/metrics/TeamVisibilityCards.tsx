import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricBlockCard } from "@/components/metrics/MetricBlockCard";

/**
 * Team Quality Rating and Team Rejection Rate, side by side.
 *
 * Both are here for visibility only: neither is a Business Gate metric, so
 * neither has a tier, a weight or a color judgement, and neither changes the
 * Gate multiplier or any score. Used on Team Performance and the Dashboard.
 */
export function TeamVisibilityCards({
  periodNoun,
  qualityRatingPct,
  qualityAuditCount,
  rejectionRatePct,
}: {
  /** "this week", "this month" -- how the period is worded under each figure. */
  periodNoun: string;
  qualityRatingPct: number | null;
  qualityAuditCount: number;
  rejectionRatePct: number | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Team Quality &amp; Rejection
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        </CardTitle>
        <CardDescription>Shown for visibility only. These two are not part of the Business Gate and do not change any score.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricBlockCard
            label="Team Quality Rating"
            value={qualityRatingPct === null ? "—" : `${qualityRatingPct.toFixed(1)}%`}
            tone="muted"
            badge={<Badge variant="outline">Visibility only</Badge>}
            weightLabel={
              qualityRatingPct === null
                ? "No QA audits recorded yet"
                : `Average of all ${qualityAuditCount} QA audit${qualityAuditCount === 1 ? "" : "s"} recorded in the app`
            }
            tooltip="The overall average score of every QA audit recorded in the app, published or not. It is the same number on every page."
            emphasized
          />
          <MetricBlockCard
            label="Team Rejection Rate"
            value={rejectionRatePct === null ? "—" : `${rejectionRatePct.toFixed(2)}%`}
            tone="muted"
            badge={<Badge variant="outline">Visibility only</Badge>}
            weightLabel={rejectionRatePct === null ? `No rejection rate entered ${periodNoun} yet` : `Average of the daily figures entered ${periodNoun}`}
            tooltip="Typed in by hand each day in Data Import, Manual Entry. A week or month is the plain average of the days that have a figure."
            emphasized
          />
        </div>
      </CardContent>
    </Card>
  );
}
