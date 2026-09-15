export interface Team {
  id: string;
  name: string;
}

export interface Agent {
  id: string;
  name: string;
  teamId: string;
  department: string;
  status: "active" | "inactive";
  tenureEligible: boolean;
  createdAt: string;
}

export type PeriodType = "daily" | "weekly" | "monthly" | "month-to-date" | "custom";

export interface Period {
  id: string;
  label: string;
  type: PeriodType;
  startDate: string;
  endDate: string;
  generatedAt: string;
}

export type ImportStatus = "extracted" | "needs_review" | "failed";

export interface ImportRow {
  id: string;
  importId: string;
  agentNameRaw: string;
  matchedAgentId: string | null;
  metricKey: string;
  rawValue: string;
  parsedValue: number | null;
  status: ImportStatus;
  note?: string;
}

export interface ImportRecord {
  id: string;
  fileName: string;
  uploadedAt: string;
  periodLabel: string | null;
  status: "pending_review" | "committed" | "failed";
  rowCount: number;
  committedAt?: string;
  /** The period this import created or merged into, set once it's
   *  committed (undefined/null before then, and for older imports
   *  committed before this field existed — see the Data Import "delete"
   *  feature in repository.ts, which uses this to know what a deleted
   *  import actually affects). Optional so every existing call that builds
   *  an ImportRecord without it — pre-commit, "pending_review" — still
   *  compiles unchanged. */
  periodId?: string | null;
}
