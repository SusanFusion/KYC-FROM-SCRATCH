/**
 * DATA NOTES & ASSUMPTIONS
 * ─────────────────────────────────────────────────────────────────────────
 * Every rule implemented in this /scoring module is taken directly from
 * "KYC KPI Realignment Framework" (07/29/2026) and the "Daily KYC Team
 * Performance Report" (generated 11-09-2026). Nothing here is invented.
 *
 * Where the source PDFs were ambiguous, silent, or internally inconsistent,
 * the decision made is recorded below instead of being silently guessed.
 * This array is rendered verbatim in the app (Settings → Data Notes) so
 * anyone reviewing scores can see exactly where a judgment call was made.
 */
export interface DataNote {
  id: string;
  title: string;
  detail: string;
  severity: "inconsistency" | "assumption" | "gap";
}

export const DATA_NOTES: DataNote[] = [
  {
    id: "worked-example-mismatch",
    title:
      `The framework's own "Elena" worked example contradicts its threshold tables`,
    severity: "inconsistency",
    detail:
      `In the Full Bonus Calculation example, "Agent Chat Avg Response Time" of 25 seconds is graded 3 (weighted 0.45), but the framework's own grading table defines 3 = <=19 sec and 2 = 20-25 sec -- 25 sec should grade 2 (weighted 0.30). Likewise CSAT of 92% is graded 3 (weighted 0.30) in the example, but the table defines 3 = >=95% and 2 = 90-94% -- 92% should grade 2 (weighted 0.20). Using the table correctly, Elena's total is 2.40, not the 2.65 shown in the example. This app implements the stated threshold tables exactly as written, not the example's arithmetic -- the example is kept as a reference/test case with the discrepancy flagged rather than treated as ground truth. Recommend confirming with the framework's authors which is correct.`,
  },
  {
    id: "csat-percentage-derivation",
    title: "CSAT % is derived from raw counts, not given directly",
    severity: "assumption",
    detail:
      'The Daily Performance Report only provides raw counts (Total Chats, CSAT, DSAT) per agent, while the framework grades a CSAT "percentage". This app computes CSAT % = CSAT ÷ (CSAT + DSAT) × 100 — i.e. share of *responded* satisfaction surveys that were positive — since the PDFs do not state the exact formula. Chats with no survey response are excluded from the denominator. If the intended formula is CSAT ÷ Total Chats instead, results will differ; this is called out on the Individual Scorecard page.',
  },
  {
    id: "missing-qa-audit-data",
    title: "QA Audit scores were not present in the source report",
    severity: "gap",
    detail:
      "The Daily KYC Team Performance Report has no QA Audit % column for any agent (QA Audits carry a 5% weight in the proposed model). Rather than invent a score, agents with no QA Audit figure on record have that metric excluded from their weighted total, and the remaining weights are re-normalized proportionally so the score still sits on a 0-3 scale. Any agent missing data is flagged with an \"Incomplete data\" badge everywhere their score appears, so the gap is visible rather than hidden inside a normal-looking number.",
  },
  {
    id: "single-department",
    title: "The source data only defines one department (KYC)",
    severity: "gap",
    detail:
      'The Individual Bonus Bracket table names a single department, "KYC", and neither PDF defines additional sub-teams. Team/department filtering is fully built, but currently only "KYC" exists as a value — everyone in the roster is assigned to it.',
  },
  {
    id: "single-period-snapshot",
    title: "Only one reporting snapshot was supplied",
    severity: "gap",
    detail:
      'The Daily Report is a single "This Month" snapshot (generated 11-09-2026). No prior-period figures were supplied, so month-over-month/trend comparisons cannot be computed from real data yet. The Trends page is fully wired to real data and will populate automatically as more periods are imported via Data Import — it intentionally shows a "not enough history yet" state rather than fabricated historical points.',
  },
  {
    id: "penalty-floor",
    title: "Final individual score is floored at 0",
    severity: "assumption",
    detail:
      "The framework defines penalty deductions (Disciplinary + Attendance) that subtract from the weighted individual score, but does not state a floor. This app clamps the post-penalty score at a minimum of 0 (a score cannot go negative) since the bonus bracket table has no negative-score row. No cap is applied to how many penalties can stack, since the PDF does not define one — this is unlike the Business Gate multiplier, which the PDF explicitly caps between 0.50 and 1.15.",
  },
  {
    id: "top-performer-definition",
    title: '"Top 1 agent" is read as the #1 overall final-score rank for the period',
    severity: "assumption",
    detail:
      "The framework identifies a Top 1 agent for the period based on final individual score. It does not explicitly define how ties are broken. This app ranks by final individual score (post-penalty, pre-gate) and, in the event of an exact tie for #1, does not silently pick one agent — both are flagged for manual confirmation. (This app surfaces rank/standing only; it does not calculate or display any bonus payout.)",
  },
  {
    id: "gate-metrics-partial",
    title: "Only 2 of the 4 Business Gate metrics were present in the sample report",
    severity: "gap",
    detail:
      'The Daily Report\'s KPI cards only show "Chat Team Avg Response Time" and "Team Ticket Resolution Time" for the Business Gate. "KYC Applications - Client Avg Wait Time" and "KYC Applications – Avg Team Processing Time" (the two heaviest-weighted gate metrics, 35% and 30%) were not present. The Gate Multiplier for this snapshot is computed from only the two available metrics, re-weighted proportionally, and clearly marked partial in the UI — it should not be treated as the true multiplier until all four metrics are imported.',
  },
  {
    id: "fd-abbreviation",
    title: '"FD" in "Agent KYC Application Ave Handling Time – FD" is undefined',
    severity: "gap",
    detail:
      "Both PDFs use the label \"FD\" for this metric without defining the abbreviation. It is kept verbatim from the source rather than guessed at (e.g. as \"Front Desk\").",
  },
];
