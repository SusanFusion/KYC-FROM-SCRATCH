import { CheckCircle2, AlertTriangle, XCircle, Sparkles, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Grade, GateTier } from "@/lib/scoring/types";

/** Individual-scorecard grade → badge (Exceptional / On Target / Below Target / Failing). */
export function GradeBadge({ grade, label }: { grade: Grade | null; label: string }) {
  if (grade === null) {
    return (
      <Badge variant="outline">
        <HelpCircle className="h-3 w-3" /> No Data
      </Badge>
    );
  }
  const map: Record<Grade, { variant: "primary" | "success" | "warning" | "danger"; Icon: typeof CheckCircle2 }> = {
    3: { variant: "primary", Icon: Sparkles },
    2: { variant: "success", Icon: CheckCircle2 },
    1: { variant: "warning", Icon: AlertTriangle },
    0: { variant: "danger", Icon: XCircle },
  };
  const { variant, Icon } = map[grade];
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" /> {label}
    </Badge>
  );
}

/** Business Gate tier → badge (Exceptional / Green / Amber / Red). */
export function TierBadge({ tier }: { tier: GateTier | null }) {
  if (tier === null) {
    return (
      <Badge variant="outline">
        <HelpCircle className="h-3 w-3" /> No Data
      </Badge>
    );
  }
  const map: Record<GateTier, { variant: "primary" | "success" | "warning" | "danger"; Icon: typeof CheckCircle2 }> = {
    Exceptional: { variant: "primary", Icon: Sparkles },
    Green: { variant: "success", Icon: CheckCircle2 },
    Amber: { variant: "warning", Icon: AlertTriangle },
    Red: { variant: "danger", Icon: XCircle },
  };
  const { variant, Icon } = map[tier];
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" /> {tier}
    </Badge>
  );
}
