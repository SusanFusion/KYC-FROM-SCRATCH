import { CheckCircle2, AlertTriangle, XCircle, Sparkles, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Grade, GateTier } from "@/lib/scoring/types";

export type Tone = "primary" | "success" | "warning" | "danger" | "muted";

/** Individual-scorecard grade → tone (Exceptional / On Target / Below Target / Failing). */
export function gradeTone(grade: Grade | null): Tone {
  if (grade === null) return "muted";
  const map: Record<Grade, Tone> = { 3: "primary", 2: "success", 1: "warning", 0: "danger" };
  return map[grade];
}

/** Business Gate tier → tone (Exceptional / Green / Amber / Red). */
export function tierTone(tier: GateTier | null): Tone {
  if (tier === null) return "muted";
  const map: Record<GateTier, Tone> = { Exceptional: "primary", Green: "success", Amber: "warning", Red: "danger" };
  return map[tier];
}

/** Individual-scorecard grade → badge (Exceptional / On Target / Below Target / Failing). */
export function GradeBadge({ grade, label }: { grade: Grade | null; label: string }) {
  if (grade === null) {
    return (
      <Badge variant="outline">
        <HelpCircle className="h-3 w-3" /> No Data
      </Badge>
    );
  }
  const iconMap: Record<Grade, typeof CheckCircle2> = { 3: Sparkles, 2: CheckCircle2, 1: AlertTriangle, 0: XCircle };
  const Icon = iconMap[grade];
  return (
    <Badge variant={gradeTone(grade) as "primary" | "success" | "warning" | "danger"}>
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
  const iconMap: Record<GateTier, typeof CheckCircle2> = {
    Exceptional: Sparkles,
    Green: CheckCircle2,
    Amber: AlertTriangle,
    Red: XCircle,
  };
  const Icon = iconMap[tier];
  return (
    <Badge variant={tierTone(tier) as "primary" | "success" | "warning" | "danger"}>
      <Icon className="h-3 w-3" /> {tier}
    </Badge>
  );
}
