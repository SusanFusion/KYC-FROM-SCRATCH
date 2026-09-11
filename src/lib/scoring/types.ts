// Core scoring-domain types. Kept dependency-free (no React/Next imports) so
// this module can be unit-tested in complete isolation from the UI.

export type Grade = 0 | 1 | 2 | 3;

export type GradeLabel = "Exceptional" | "On Target" | "Below Target" | "Failing";

export type GateTier = "Exceptional" | "Green" | "Amber" | "Red";

/** Individual scorecard metric keys, per the Proposed Individual Grading Scales. */
export type IndividualMetricKey =
  | "appAHT" // Agent KYC Application Ave Handling Time – FD (35%)
  | "emailAHT" // Agent KYC Email Ave Handling Time (Ticket AHT) - includes KYB (25%)
  | "chatAvgResponse" // Agent Chat Avg Response Time (15%)
  | "chatFRT" // Agent Chat First Response Time (10%)
  | "csatDsat" // CSAT / DSAT (10%)
  | "qaAudit"; // QA Audits (5%)

/** Business Gate (Layer 1, team-level) metric keys. */
export type GateMetricKey =
  | "clientAvgWaitTime" // KYC Applications - Client Avg Wait Time (All statuses) (35%)
  | "teamProcessingTime" // KYC Applications – Avg Team Processing Time (CS and KYC Statuses) (30%)
  | "chatTeamAvgResponse" // Chat - Team Average Response Time (20%)
  | "teamTicketAHT"; // Team Ticket AHT (includes KYB Application Tickets) (15%)

export type Direction = "lower-is-better" | "higher-is-better";

export interface GradeBand {
  grade: Grade;
  label: GradeLabel;
  /** Inclusive lower bound in the metric's base unit, or null for unbounded. */
  min: number | null;
  /** Inclusive upper bound in the metric's base unit, or null for unbounded. */
  max: number | null;
}

export interface IndividualMetricDefinition {
  key: IndividualMetricKey;
  name: string;
  weight: number; // fraction, e.g. 0.35
  unit: "minutes" | "seconds" | "percent";
  direction: Direction;
  target: string; // human-readable target, taken verbatim from the source PDF
  bands: GradeBand[];
}

export interface GateTierScore {
  tier: GateTier;
  score: number;
}

export interface GateBand {
  tier: GateTier;
  min: number | null;
  max: number | null;
}

export interface GateMetricDefinition {
  key: GateMetricKey;
  name: string;
  weight: number;
  unit: "minutes" | "seconds";
  direction: Direction;
  bands: GateBand[];
}

/** Raw (unmodified, as-imported) per-agent metric inputs for one reporting period. */
export interface RawAgentMetrics {
  agentId: string;
  periodId: string;
  totalChatConversations: number | null;
  avgFirstResponseTimeSec: number | null; // Chat FRT
  avgResponseTimeSec: number | null; // Chat avg response time
  emailAHTSec: number | null; // Ticket AHT incl. KYB
  appAHTSec: number | null; // Application AHT – FD
  totalChats: number | null;
  csatCount: number | null;
  dsatCount: number | null;
  qaAuditPct: number | null; // null = not measured this period
}

/** Raw team-level (Business Gate) inputs for one reporting period. */
export interface RawGateMetrics {
  periodId: string;
  clientAvgWaitTimeMin: number | null;
  teamProcessingTimeMin: number | null;
  chatTeamAvgResponseSec: number | null;
  teamTicketAHTMin: number | null;
}

export type PenaltyCode =
  | "coaching_opportunity"
  | "major_quality_defect"
  | "brand_misuse"
  | "invalid_approval"
  | "invalid_rejection"
  | "repeated_offenses"
  | "late_under_15"
  | "late_over_15"
  | "undertime"
  | "half_day"
  | "unexcused_absence"
  | "absence_with_documentation";

export type PenaltyCategory = "disciplinary" | "attendance";

export interface PenaltyDefinition {
  code: PenaltyCode;
  category: PenaltyCategory;
  label: string;
  deduction: number; // positive number, subtracted from score
  example: string;
}

export interface PenaltyEntry {
  id: string;
  agentId: string;
  periodId: string;
  code: PenaltyCode;
  count: number;
  note?: string;
  occurredOn: string; // ISO date
}

export interface BonusBracket {
  scoreMin: number;
  scoreMax: number | null; // null = unbounded above (only used for the top bracket, exclusive-open handled via >=)
  percentage: number; // fraction, e.g. 0.05
  phpAmount: number;
  label: string;
}

export interface MetricScoreBreakdown {
  key: IndividualMetricKey;
  name: string;
  actual: number | null;
  actualDisplay: string;
  target: string;
  weight: number;
  grade: Grade | null;
  gradeLabel: GradeLabel | "No Data";
  weightedPoints: number | null; // grade * weight, null if excluded (no data)
  excluded: boolean;
  /** e.g. "5.2s under" — distance to the On Target/Below Target boundary,
   *  regardless of which band the value actually falls in. Null if excluded. */
  bufferLabel: string | null;
  /** true = safe margin before the "needs attention" tier; false = already past it. */
  bufferGood: boolean | null;
}

export interface IndividualScoreResult {
  agentId: string;
  periodId: string;
  metrics: MetricScoreBreakdown[];
  hasIncompleteData: boolean;
  weightedSubtotal: number; // sum of weighted points actually available
  effectiveWeight: number; // sum of weights actually available (for renormalization)
  baseScore: number; // weightedSubtotal renormalized to the full 0-3 scale
  maxScore: number; // always 3
  penaltyTotal: number;
  penaltiesApplied: { code: PenaltyCode; label: string; deduction: number; count: number }[];
  finalScore: number; // baseScore - penaltyTotal, floored at 0
}

export interface GateMetricBreakdown {
  key: GateMetricKey;
  name: string;
  actual: number | null;
  actualDisplay: string;
  weight: number;
  tier: GateTier | null;
  tierScore: number | null;
  weightedContribution: number | null;
  /** e.g. "5.2s under" — distance to the Green/Amber boundary, regardless of
   *  which tier the value actually falls in. Null if no data. */
  bufferLabel: string | null;
  /** true = safe margin before Amber; false = already past it. */
  bufferGood: boolean | null;
}

export interface BusinessGateResult {
  periodId: string;
  metrics: GateMetricBreakdown[];
  gateMultiplier: number; // 0.50 - 1.15
  overallTier: GateTier;
}

export interface AgentBonusResult {
  agentId: string;
  periodId: string;
  finalScore: number;
  bracket: BonusBracket;
  baseBonusPhp: number;
  gateMultiplier: number;
  bonusAfterGate: number;
  isTopPerformer: boolean;
  topPerformerBonusPhp: number;
  totalBonusPhp: number;
  tenureEligible: boolean;
}
