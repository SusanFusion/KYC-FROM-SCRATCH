// QA Audit forms — Applications / Emails / Chats.
//
// Phase 1 only defines "applications" (see qa-quality/page.tsx). "emails" and
// "chats" are typed and wired everywhere else (DB, repository, API routes,
// the UI panel) so adding them later is just adding their AuditDefinition
// here — no other file needs to change shape.
//
// Kept dependency-free (no React/Next imports), same philosophy as
// lib/scoring/types.ts — the scoring math here is unit-testable on its own.

export type QaAuditType = "applications" | "emails" | "chats";

export const QA_AUDIT_TYPE_LABELS: Record<QaAuditType, string> = {
  applications: "Applications Quality Audit",
  emails: "Emails Audit",
  chats: "Chats Audit",
};

export type QaAnswerValue = "yes" | "no" | "na";

export type QaAuditStatus = "submitted" | "published";

export interface QaAuditAnswer {
  questionKey: string;
  value: QaAnswerValue;
}

/** One reviewable checklist item. `key` is a stable id used to store the
 *  answer — it must never change once audits have been submitted against
 *  it, or old records' answers will stop lining up with their questions. */
export interface AuditQuestionDef {
  key: string;
  label: string;
}

export interface AuditSectionDef {
  key: string;
  title: string;
  /** Zero-tolerance section. Its questions are phrased as violations (e.g.
   *  "Incorrectly Approved/Declined") rather than as correct-practice checks,
   *  so the Yes/No polarity is intentionally flipped here versus every other
   *  section: "No" (the violation did not occur) is the normal, no-penalty
   *  answer and earns the point same as "Yes" does elsewhere; "Yes" (the
   *  violation did occur) earns no point AND forces the whole audit's band
   *  to 0, regardless of its overall percentage. See computeAuditScore(). */
  autoFail?: boolean;
  questions: AuditQuestionDef[];
}

export interface AuditBandThreshold {
  grade: 0 | 1 | 2 | 3;
  label: string;
  min: number | null;
  max: number | null;
}

export interface AuditDefinition {
  type: QaAuditType;
  label: string;
  /** Name of the source form, shown on the PDF export footer for traceability. */
  sourceFormName: string;
  sections: AuditSectionDef[];
}

// Same BAND QUALITY AUDITS reference table printed at the bottom of all
// three source forms (Applications/Emails/Chats) — identical thresholds
// across all audit types.
export const QA_AUDIT_BANDS: AuditBandThreshold[] = [
  { grade: 3, label: "Exceptional", min: 95, max: null },
  { grade: 2, label: "On Target", min: 85, max: 95 },
  { grade: 1, label: "Below Target", min: 75, max: 85 },
  { grade: 0, label: "Failing", min: null, max: 75 },
];

const APPLICATIONS_DEFINITION: AuditDefinition = {
  type: "applications",
  label: QA_AUDIT_TYPE_LABELS.applications,
  sourceFormName: "FMGP - KYC Client Success QA Form",
  sections: [
    {
      key: "decision_accuracy",
      title: "Decision Accuracy",
      questions: [
        { key: "da_1", label: "Did the agent review that all required identity documents valid, acceptable, and matched to the applicant?" },
        {
          key: "da_2",
          label:
            "Did the agent review that all required verification checks are completed before making a decision? (Address, duplicate accounts, IP, Sumsub, country restrictions, etc., as applicable)",
        },
        { key: "da_3", label: "Were all fraud or high-risk indicators identified and handled according to SOP?" },
        { key: "da_4", label: "Did the agent gather sufficient evidence before approving or declining the application?" },
        { key: "da_5", label: "Was the final approval/decline decision correct based on policy and requirements provided?" },
        { key: "da_6", label: "Were policy exceptions identified and handled correctly? (if applicable)" },
        { key: "da_7", label: "Was the appropriate SOP/Knowledge Base followed throughout the review?" },
        {
          key: "da_8",
          label:
            "If Sumsub approved - did the agent follow the correct process/action to take? Ensuring that the pending matters are addressed.",
        },
      ],
    },
    {
      key: "case_handling",
      title: "Case Handling",
      questions: [
        { key: "ch_1", label: "Was the correct workflow followed (pend, escalate, or continue review) when required?" },
        { key: "ch_2", label: "Was the application assigned to the correct referral, CXD, or manager group (if applicable)?" },
        { key: "ch_3", label: "Were all required customer communications and follow-ups (if applicable) completed correctly?" },
        {
          key: "ch_4",
          label:
            "Were SLA/timeframe requirements met (including the 48-hour follow-up rule if applicable)? Normal application - follows processing in less than 30 minutes",
        },
        { key: "ch_5", label: "Was the case endorsed/escalated to the correct team/authorities?" },
      ],
    },
    {
      key: "documentation_closing",
      title: "Documentation & Closing",
      questions: [
        { key: "dc_1", label: "Were the agent's notes accurate, complete, and sufficient to support the decision?" },
        { key: "dc_2", label: "Were the correct ticket status, and group applied?" },
        { key: "dc_3", label: "Was the application actioned in the IDV page?" },
        { key: "dc_4", label: "Was the KYC Status appropriately updated?" },
        { key: "dc_5", label: "Was the ticket closed correctly according to SOP? (No premature tagging?)" },
      ],
    },
    {
      key: "auto_fail",
      title: "Auto-Fail",
      autoFail: true,
      questions: [
        // The source spreadsheet's text was cut off mid-parenthesis here
        // ("Incorrectly Approved/Declined (Approved t...") — kept to the
        // clearly-legible part rather than guessing at the rest. Adjust the
        // wording below if you want the full original phrasing restored.
        { key: "af_1", label: "Incorrectly Approved/Declined" },
        { key: "af_2", label: "Inactioned/Missed Application" },
      ],
    },
  ],
};

export const AUDIT_DEFINITIONS: Partial<Record<QaAuditType, AuditDefinition>> = {
  applications: APPLICATIONS_DEFINITION,
};

export function getAuditDefinition(type: QaAuditType): AuditDefinition {
  const def = AUDIT_DEFINITIONS[type];
  if (!def) throw new Error(`No audit definition for "${type}" yet.`);
  return def;
}

export function allQuestionKeys(def: AuditDefinition): string[] {
  return def.sections.flatMap((s) => s.questions.map((q) => q.key));
}

/**
 * Default answers a fresh submit form starts pre-filled with, so the
 * auditor only has to click the exceptions rather than every question:
 * "Yes" for ordinary correct-practice questions, and "No" for Auto-Fail
 * section questions (i.e. the violation they describe did not occur — the
 * normal, no-penalty case; see AuditSectionDef.autoFail). The auditor can
 * still change any answer, including to N/A.
 */
export function buildDefaultAnswers(def: AuditDefinition): Record<string, QaAnswerValue> {
  const defaults: Record<string, QaAnswerValue> = {};
  for (const section of def.sections) {
    for (const q of section.questions) {
      defaults[q.key] = section.autoFail ? "no" : "yes";
    }
  }
  return defaults;
}

export interface ComputedAuditScore {
  applicablePoints: number;
  totalPoints: number;
  /** null only when every question was answered N/A (nothing applicable to score). */
  percentage: number | null;
  autoFail: boolean;
  band: 0 | 1 | 2 | 3 | null;
}

/**
 * Pure scoring function — same math for every audit type, mirroring the
 * "TOTAL SCORE / Percentage / BAND QUALITY AUDITS" rules printed on all
 * three source forms: N/A answers are excluded from both the numerator and
 * denominator. Auto-Fail sections have flipped Yes/No polarity (see the
 * doc comment on AuditSectionDef.autoFail) — "No" earns the point same as
 * "Yes" does everywhere else, and "Yes" earns no point and forces band to 0
 * regardless of the computed percentage (the percentage itself is still
 * returned/displayed, per those forms' own notes).
 */
export function computeAuditScore(answers: Record<string, QaAnswerValue | undefined>, def: AuditDefinition): ComputedAuditScore {
  let applicablePoints = 0;
  let totalPoints = 0;
  let autoFail = false;

  for (const section of def.sections) {
    for (const q of section.questions) {
      const value = answers[q.key];
      if (value === "yes" || value === "no") {
        applicablePoints += 1;
        if (section.autoFail) {
          if (value === "no") totalPoints += 1;
          if (value === "yes") autoFail = true;
        } else {
          if (value === "yes") totalPoints += 1;
        }
      }
      // "na" or unanswered — excluded from both numerator and denominator.
    }
  }

  const percentage = applicablePoints > 0 ? (totalPoints / applicablePoints) * 100 : null;
  let band: 0 | 1 | 2 | 3 | null = null;
  if (percentage !== null) {
    band = percentage >= 95 ? 3 : percentage >= 85 ? 2 : percentage >= 75 ? 1 : 0;
  }
  if (autoFail && band !== null) band = 0;

  return { applicablePoints, totalPoints, percentage, autoFail, band };
}

export function bandLabel(band: 0 | 1 | 2 | 3 | null): string {
  if (band === null) return "No data";
  return QA_AUDIT_BANDS.find((b) => b.grade === band)?.label ?? "—";
}

/**
 * A submitted (or published) audit record — the confidential form data plus
 * its computed score. Agent name / period label / auditor name are
 * denormalized onto the record at creation time purely for display and PDF
 * export, so the list/detail UI and the PDF never need extra joins against
 * agents/periods/roster — none of those three ever change after the fact
 * for a given audit (an agent being renamed later doesn't rewrite history).
 *
 * CONFIDENTIALITY: `answers` and `overallRemarks` are exactly the "contents/
 * comments/remarks" that must stay hidden from agents — every server route
 * that returns a full QaAuditRecord is guarded by requireActionAccess() (the
 * same shared Lead/Manager password as Data Import), and the QA Quality
 * page never fetches this shape until that password has been entered in the
 * browser. Only the computed, blended qaAuditPct that publishing writes
 * onto the agent's period (see the publish route) is ever public — that's
 * the existing "QA Audit %" already shown on Scorecards/Dashboard/Trends,
 * completely unchanged by any of this.
 */
export interface QaAuditRecord {
  id: string;
  auditType: QaAuditType;
  agentId: string;
  agentName: string;
  periodId: string;
  periodLabel: string;
  auditorEmail: string;
  auditorName: string;
  caseReference: string | null;
  auditDate: string; // YYYY-MM-DD
  answers: QaAuditAnswer[];
  overallRemarks: string | null;
  applicablePoints: number;
  totalPoints: number;
  percentage: number | null;
  autoFail: boolean;
  band: 0 | 1 | 2 | 3 | null;
  status: QaAuditStatus;
  createdAt: string;
  updatedAt: string;
}

/** Input shape for creating a new audit — everything the score is computed
 *  from, before the server attaches an id/timestamps/computed fields. */
export interface NewQaAuditInput {
  auditType: QaAuditType;
  agentId: string;
  agentName: string;
  periodId: string;
  periodLabel: string;
  auditorEmail: string;
  auditorName: string;
  caseReference: string | null;
  auditDate: string;
  answers: QaAuditAnswer[];
  overallRemarks: string | null;
}
