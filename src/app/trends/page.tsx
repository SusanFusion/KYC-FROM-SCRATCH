import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RangePicker } from "@/components/shared/RangePicker";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { MetricTrendChart, type MetricTrendPoint } from "@/components/charts/MetricTrendChart";
import { MetricDeltaGrid, deltaBadgeVariant, type MetricDeltaDatum } from "@/components/charts/MetricDeltaGrid";
import {
  loadRangeDataset,
  listAvailableWeeks,
  loadAgentDailyTrend,
  loadGateDailyTrend,
  loadGateMetricsDailyTrend,
  gateMultiplierOrNull,
  type AgentPeriodResult,
} from "@/lib/data/query";
import { shiftWeek, formatWeekLabel, formatWeekShortLabel } from "@/lib/data/dateRanges";
import { INDIVIDUAL_METRICS, GATE_METRICS, GATE_MULTIPLIER_MIN, GATE_MULTIPLIER_MAX } from "@/lib/scoring";
import { formatActual } from "@/lib/scoring/individualScore";
import { formatMagnitude, roundToDisplayPrecision } from "@/lib/scoring/display";
import type { IndividualMetricKey } from "@/lib/scoring/types";
import { EmptyState } from "@/components/shared/EmptyState";

export const dynamic = "force-dynamic";

// An agent with no import yet still gets a row (see query.ts) so Rankings
// and Scorecards can list them — but their 0.00 placeholder score has no
// business dragging a team
