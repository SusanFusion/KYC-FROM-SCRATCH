import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { getRepository } from "@/lib/data/repository";
import { requireActionAccess } from "@/lib/auth/actionAccess";
import { describeError, formatDate, slugify } from "@/lib/utils";
import {
  bandLabel,
  getAuditDefinition,
  QA_AUDIT_TYPE_LABELS,
  type AuditSectionDef,
  type QaAnswerValue,
  type QaAuditRecord,
} from "@/lib/qa/auditDefinitions";

export const runtime = "nodejs";

// Renders a submitted/published audit as a real, downloadable PDF -- meant to
// be attached to an email (Outlook or otherwise), per the request.
// @react-pdf/renderer builds the PDF directly in Node (no headless browser
// needed, so this works fine on Vercel's serverless functions) from a small
// React-like component tree of its own primitives (Document/Page/View/Text)
// -- this route file is .tsx (not .ts) because that JSX needs a Next.js
// route handler that supports it, same reason next/og's ImageResponse
// routes are always .tsx.
//
// Design: the whole page is themed by the audit's OUTCOME, not a fixed
// palette -- see themeFor() below. A perfect audit (100%, no deductions,
// no auto-fail) reads cool and calm; an audit that passed but lost points
// somewhere reads warm; a failing or auto-failed audit reads red. Individual
// answers are colored by whether they were the "good" or "costly" answer for
// THEIR section (auto-fail sections have flipped Yes/No polarity -- see
// isGoodAnswer()), so a scan down the page finds every deduction without
// reading every row.

// ── Theme ────────────────────────────────────────────────────────────────

interface Theme {
  name: "cool" | "warm" | "red";
  accent: string; // section headers, hero border, stat values
  accentDeep: string; // hero big number, strongest text
  soft: string; // pale tinted background (hero, section header)
  border: string; // hairline border tuned to the theme
}

const COOL_THEME: Theme = { name: "cool", accent: "#0f766e", accentDeep: "#0f4c4a", soft: "#ecfdf9", border: "#99e6da" };
const WARM_THEME: Theme = { name: "warm", accent: "#b45309", accentDeep: "#7c3d0a", soft: "#fef6e7", border: "#f3d38a" };
const RED_THEME: Theme = { name: "red", accent: "#b91c1c", accentDeep: "#7f1d1d", soft: "#fdecec", border: "#f3aeae" };

const INK = "#1f2937";
const MUTED = "#6b7280";
const HAIRLINE = "#e9e7e3";
const GOOD = "#166534";
const GOOD_SOFT = "#eef7ef";
const BAD = "#b91c1c";
const BAD_SOFT = "#fdecec";

function themeFor(audit: QaAuditRecord): Theme {
  const failing = audit.autoFail || audit.band === 0;
  if (failing) return RED_THEME;
  const perfect = audit.percentage === 100;
  if (perfect) return COOL_THEME;
  return WARM_THEME;
}

/** true = the "safe"/no-deduction answer for this question, false = the
 *  answer that cost a point (or triggered auto-fail), null = N/A / no
 *  answer (neutral). Auto-fail sections are phrased as violations, so their
 *  Yes/No polarity is intentionally flipped -- see AuditSectionDef.autoFail. */
function isGoodAnswer(section: AuditSectionDef, value: QaAnswerValue | undefined): boolean | null {
  if (value !== "yes" && value !== "no") return null;
  return section.autoFail ? value === "no" : value === "yes";
}

/** Per-section point tally, same rules computeAuditScore() applies across
 *  the whole form (see auditDefinitions.ts), just scoped to one section --
 *  used only for the small "x/y" shown in each section's header. */
function sectionTally(section: AuditSectionDef, answerByKey: Map<string, QaAnswerValue>, excludeNa: boolean): { points: number; applicable: number } {
  let points = 0;
  let applicable = excludeNa ? 0 : section.questions.length;
  for (const q of section.questions) {
    const value = answerByKey.get(q.key);
    if (excludeNa) {
      if (value !== "yes" && value !== "no") continue;
      applicable += 1;
      if (section.autoFail ? value === "no" : value === "yes") points += 1;
    } else {
      if (section.autoFail ? value === "no" || value === "na" : value === "yes" || value === "na") points += 1;
    }
  }
  return { points, applicable };
}

function answerLabel(value: string | undefined): string {
  if (value === "yes") return "YES";
  if (value === "no") return "NO";
  if (value === "na") return "N/A";
  return "—";
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 44, paddingHorizontal: 34, fontSize: 9.5, fontFamily: "Helvetica", color: INK },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 6 },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  title: { fontSize: 17, fontWeight: 700, color: INK },
  subtitle: { fontSize: 9, color: MUTED, marginTop: 2 },
  statusPill: {
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 9,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 14 },
  metaCell: { width: "33.33%", marginBottom: 9, paddingRight: 10 },
  metaLabel: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 },
  metaValue: { fontSize: 10, fontWeight: 700, color: INK },

  hero: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.25,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  heroPercentBlock: { minWidth: 96 },
  heroPercent: { fontSize: 30, fontWeight: 700 },
  heroBandPill: { alignSelf: "flex-start", borderRadius: 9, paddingVertical: 3, paddingHorizontal: 8, marginTop: 5 },
  heroBandPillText: { fontSize: 8, fontWeight: 700, color: "#ffffff", textTransform: "uppercase", letterSpacing: 0.4 },
  heroDivider: { width: 1, alignSelf: "stretch", backgroundColor: "#ffffff", opacity: 0.6, marginHorizontal: 18 },
  heroStat: { marginRight: 22 },
  heroStatValue: { fontSize: 13.5, fontWeight: 700, color: INK },
  heroStatLabel: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 },
  heroAutoFailPill: {
    marginLeft: "auto",
    backgroundColor: "#7f1d1d",
    borderRadius: 9,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  heroAutoFailText: { fontSize: 8, fontWeight: 700, color: "#ffffff", textTransform: "uppercase", letterSpacing: 0.4 },

  card: { borderRadius: 12, borderWidth: 1, borderColor: HAIRLINE, marginBottom: 10, overflow: "hidden" },
  cardAutoFail: { borderColor: "#f3aeae" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  sectionTitle: { fontSize: 9.5, fontWeight: 700, color: "#ffffff" },
  sectionTag: {
    fontSize: 6.5,
    fontWeight: 700,
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 1.5,
  },
  sectionTally: { fontSize: 9, fontWeight: 700, color: "#ffffff" },

  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 0.75,
    borderBottomColor: HAIRLINE,
    backgroundColor: "#ffffff",
  },
  questionRowLast: { borderBottomWidth: 0 },
  questionRowBad: { backgroundColor: BAD_SOFT },
  questionLabel: { flex: 1, paddingRight: 10, color: INK, lineHeight: 1.35 },
  answerPill: { minWidth: 34, borderRadius: 8, paddingVertical: 2.5, paddingHorizontal: 7, alignItems: "center" },
  answerPillGood: { backgroundColor: GOOD_SOFT },
  answerPillBad: { backgroundColor: BAD },
  answerPillNeutral: { backgroundColor: "#f1f1ef" },
  answerPillText: { fontSize: 7.5, fontWeight: 700, letterSpacing: 0.3 },
  answerPillTextGood: { color: GOOD },
  answerPillTextBad: { color: "#ffffff" },
  answerPillTextNeutral: { color: MUTED },

  remarksCard: { borderRadius: 12, borderWidth: 1, borderColor: HAIRLINE, backgroundColor: "#faf9f6", padding: 12, marginTop: 4, marginBottom: 6 },
  remarksLabel: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
  remarksText: { fontSize: 9.5, color: INK, lineHeight: 1.45 },

  footer: { position: "absolute", bottom: 20, left: 34, right: 34, fontSize: 7.5, color: MUTED, textAlign: "center" },
  pageNumber: { position: "absolute", bottom: 20, right: 34, fontSize: 7.5, color: MUTED },
});

function AuditPdfDocument({ audit }: { audit: QaAuditRecord }) {
  const definition = getAuditDefinition(audit.auditType);
  const answerByKey = new Map(audit.answers.map((a) => [a.questionKey, a.value]));
  const theme = themeFor(audit);
  const excludeNa = definition.naExcludedFromDenominator === true;
  const failing = audit.autoFail || audit.band === 0;

  const metaItems: { label: string; value: string }[] = [
    { label: "Agent", value: audit.agentName },
    { label: "Period", value: audit.periodLabel },
    { label: "Audit Date", value: formatDate(audit.auditDate) },
    { label: "Auditor", value: audit.auditorName },
    { label: "Status", value: audit.status === "published" ? "Published" : "Submitted" },
    ...(audit.caseReference ? [{ label: "Case / Ticket Ref.", value: audit.caseReference }] : []),
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.topBar, { backgroundColor: theme.accent }]} fixed />

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{QA_AUDIT_TYPE_LABELS[audit.auditType]}</Text>
            <Text style={styles.subtitle}>{definition.sourceFormName}</Text>
          </View>
          <Text
            style={[
              styles.statusPill,
              {
                color: theme.accentDeep,
                backgroundColor: theme.soft,
                borderWidth: 1,
                borderColor: theme.border,
              },
            ]}
          >
            {audit.status === "published" ? "Published" : "Submitted"}
          </Text>
        </View>

        <View style={styles.metaGrid}>
          {metaItems.map((item) => (
            <View key={item.label} style={styles.metaCell}>
              <Text style={styles.metaLabel}>{item.label}</Text>
              <Text style={styles.metaValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.hero, { backgroundColor: theme.soft, borderColor: theme.border }]}>
          <View style={styles.heroPercentBlock}>
            <Text style={[styles.heroPercent, { color: theme.accentDeep }]}>
              {audit.percentage !== null ? `${audit.percentage.toFixed(1)}%` : "—"}
            </Text>
            <View style={[styles.heroBandPill, { backgroundColor: theme.accent }]}>
              <Text style={styles.heroBandPillText}>{bandLabel(audit.band)}</Text>
            </View>
          </View>

          <View style={[styles.heroDivider, { backgroundColor: theme.border }]} />

          <View style={styles.heroStat}>
            <Text style={[styles.heroStatValue, { color: theme.accentDeep }]}>
              {audit.totalPoints}/{audit.applicablePoints}
            </Text>
            <Text style={styles.heroStatLabel}>Points</Text>
          </View>

          <View style={styles.heroStat}>
            <Text style={[styles.heroStatValue, { color: theme.accentDeep }]}>{definition.sections.length}</Text>
            <Text style={styles.heroStatLabel}>Sections Reviewed</Text>
          </View>

          {audit.autoFail && (
            <View style={styles.heroAutoFailPill}>
              <Text style={styles.heroAutoFailText}>Auto-Fail Triggered</Text>
            </View>
          )}
        </View>

        {definition.sections.map((section) => {
          const tally = sectionTally(section, answerByKey, excludeNa);
          const cardStyle = section.autoFail ? [styles.card, styles.cardAutoFail] : [styles.card];
          const headerBg = section.autoFail ? "#7f1d1d" : theme.accent;
          return (
            <View key={section.key} style={cardStyle} wrap={false}>
              <View style={[styles.sectionHeader, { backgroundColor: headerBg }]}>
                <View>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  {section.autoFail && <Text style={styles.sectionTag}>Zero tolerance — any violation fails the audit</Text>}
                </View>
                <Text style={styles.sectionTally}>
                  {tally.points}/{tally.applicable}
                </Text>
              </View>

              {section.questions.map((q, qi) => {
                const value = answerByKey.get(q.key);
                const good = isGoodAnswer(section, value);
                const isLast = qi === section.questions.length - 1;
                const rowStyle = [styles.questionRow, ...(isLast ? [styles.questionRowLast] : []), ...(good === false ? [styles.questionRowBad] : [])];
                const labelStyle = [styles.questionLabel, ...(good === false ? [{ color: BAD, fontWeight: 700 as const }] : [])];
                const pillStyle = good === true ? styles.answerPillGood : good === false ? styles.answerPillBad : styles.answerPillNeutral;
                const pillTextStyle =
                  good === true ? styles.answerPillTextGood : good === false ? styles.answerPillTextBad : styles.answerPillTextNeutral;
                return (
                  <View key={q.key} style={rowStyle}>
                    <Text style={labelStyle}>{q.label}</Text>
                    <View style={[styles.answerPill, pillStyle]}>
                      <Text style={[styles.answerPillText, pillTextStyle]}>{answerLabel(value)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        {audit.overallRemarks && (
          <View style={[styles.remarksCard, { borderColor: theme.border }]} wrap={false}>
            <Text style={styles.remarksLabel}>Overall Remarks</Text>
            <Text style={styles.remarksText}>{audit.overallRemarks}</Text>
          </View>
        )}

        <Text style={styles.footer} fixed>
          Confidential — KYC Team Performance QA Audit{failing ? " · Escalation may apply per SOP" : ""}. Generated{" "}
          {formatDate(new Date().toISOString())}.
        </Text>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const denied = await requireActionAccess();
  if (denied) return denied;

  try {
    const repo = await getRepository();
    const audit = await repo.getQaAuditById(params.id);
    if (!audit) return NextResponse.json({ error: "Audit not found." }, { status: 404 });

    const buffer = await renderToBuffer(<AuditPdfDocument audit={audit} />);
    const slug = slugify(`${audit.auditType}-${audit.agentName}-${audit.auditDate}`);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="qa-audit-${slug}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error while generating the PDF.", detail: describeError(err) }, { status: 500 });
  }
}
