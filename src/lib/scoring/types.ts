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
  /** Email + KYB ticket volume this agent handled this day (the "Agent KYC
   *  Email Ave Volume" report table) — NOT the application-ticket count;
   *  per Susan, Team Ticket AHT is scored on email/KYB tickets only. Used
   *  solely to weight the team-level teamTicketAHTMin average by actual
   *  daily ticket volume instead of averaging days equally (see
   *  aggregateGate in query.ts) — never scored or displayed on its own. */
  emailTicketCount: number | null;
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
  | "late_onsite_under_15"
  | "late_onsite_15_plus"
  | "late_wfh_under_15"
  | "late_wfh_15_plus"
  | "undertime"
  | "half_day"
  | "unexcused_absence"
  | "absence_with_documentation"
  // Employment track-record actions -- no score deduction (see
  // EMPLOYMENT_ACTIONS in thresholds.ts), logged for HR/escalation history.
  | "feedback"
  | "verbal_warning"
  | "written_warning"
  | "final_warning"
  | "suspension"
  | "dismissal";

export type PenaltyCategory = "disciplinary" | "attendance" | "escalation";

/** Badge shown in place of a numeric deduction for escalation-only actions
 *  (deduction is always 0 for these) -- see EMPLOYMENT_ACTIONS. Absent on
 *  disciplinary/attendance entries, which keep the plain deduction badge. */
export interface PenaltyStatus {
  label: string;
  variant: "default" | "warning" | "danger" | "outline";
}

/** Meters a penalty code so it's free for the first few times in a calendar
 *  month and only deducts every Nth occurrence -- e.g. { every: 4, deduction:
 *  0.05 } means the 1st-3rd time this code is recorded in a month are free,
 *  the 4th deducts -0.05, the 5th-7th are free again, the 8th deducts, and
 *  so on, resetting at the start of each calendar month. `deduction` here is
 *  what's actually applied on a triggering occurrence -- the definition's
 *  own top-level `deduction` is shown as the "if it triggers" amount in the
 *  UI (see PenaltyForm), not applied directly. See calculatePenalty's
 *  monthlyGraceShare for the actual math. */
export interface PenaltyMonthlyGrace {
  every: number;
  deduction: number;
}

export interface PenaltyDefinition {
  code: PenaltyCode;
  category: PenaltyCategory;
  label: string;
  deduction: number; // positive number, subtracted from score
  example: string;
  status?: PenaltyStatus;
  monthlyGrace?: PenaltyMonthlyGrace;
}

export interface PenaltyEntry {
  id: string;
  agentId: string;
  periodId: string;
  code: PenaltyCode;
  count: number;
  note?: string;
  occurredOn: string; // ISO date
  /** Who recorded this entry (free text, typed on the "Record a penalty"
   *  form) -- there's no per-user login in this app (see actionAccess.ts),
   *  just a shared password, so this is the only record of who logged it. */
  recordedBy: string;
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
  penaltiesApplied: {
    id: string;
    code: PenaltyCode;
    label: string;
    deduction: number;
    count: number;
    occurredOn: string;
    recordedBy: string;
    status?: PenaltyStatus;
  }[];
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
