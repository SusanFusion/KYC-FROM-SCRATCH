import { AlertTriangle, CheckCircle2, HelpCircle, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricBlockCard } from "@/components/metrics/MetricBlockCard";
import type { Tone } from "@/components/dashboard/PerformanceBadge";

// Color of the Team Quality Rating. Display only: it never feeds the Business
// Gate or any score. 90% and above is green, 80% up to (not including) 90% is
// amber, below 80% is red. The check uses the same one-decimal number that is
// shown on the card, so 89.9% reads amber and 90.0% reads green.
export const QUALITY_GREEN_MIN = 90;
export const QUALITY_AMBER_MIN = 80;

function qualityTone(pct: number | null): Tone {
  if (pct === null) return "muted";
  if (pct >= QUALITY_GREEN_MIN) return "success";
  if (pct >= QUALITY_AMBER_MIN) return "warning";
  return "danger";
}

function QualityBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <Badge variant="outline">
        <HelpCircle className="h-3 w-3" /> No Data
      </Badge>
    );
  }
  if (pct >= QUALITY_GREEN_MIN) {
    return (
      <Badge variant="success">
        <CheckCircle2 className="h-3 w-3" /> Green
      </Badge>
    );
  }
  if (pct >= QUALITY_AMBER_MIN) {
    return (
      <Badge variant="warning">
        <AlertTriangle className="h-3 w-3" /> Amber
      </Badge>
    );
  }
  return (
    <Badge variant="danger">
      <XCircle className="h-3 w-3" /> Red
    </Badge>
  );
}

/**
 * Team Quality Rating and Team Rejection Rate, side by side.
 *
 * Both are here for visibility only: neither is a Business Gate metric, so
 * neither has a weight and neither changes the Gate multiplier or any score.
 * The Team Quality Rating is color-coded (green 90%+, amber 80% to under 90%,
 * red under 80%); the Rejection Rate has no color. Used on Team Performance
 * and the Dashboard.
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
            tone={qualityTone(qualityRatingPct)}
            badge={<QualityBadge pct={qualityRatingPct} />}
            weightLabel={
              qualityRatingPct === null
                ? "No QA audits recorded yet"
                : `Average of all ${qualityAuditCount} QA audit${qualityAuditCount === 1 ? "" : "s"} recorded in the app`
            }
            tooltip="The overall average score of every QA audit recorded in the app, published or not. It is the same number on every page. Green is 90% and above, Amber is 80% up to under 90%, Red is under 80%."
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
