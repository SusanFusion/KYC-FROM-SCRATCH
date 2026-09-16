import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { getRepository } from "@/lib/data/repository";
import { requireActionAccess } from "@/lib/auth/actionAccess";
import { describeError, formatDate, slugify } from "@/lib/utils";
import { bandLabel, getAuditDefinition, QA_AUDIT_TYPE_LABELS, type QaAuditRecord } from "@/lib/qa/auditDefinitions";

export const runtime = "nodejs";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#6b7280", marginBottom: 14 },
  metaRow: { flexDirection: "row", marginBottom: 3 },
  metaLabel: { width: 110, color: "#6b7280" },
  metaValue: { flex: 1, fontWeight: 700 },
  scoreBox: { marginTop: 10, marginBottom: 14, padding: 10, borderRadius: 4, backgroundColor: "#f3f4f6", flexDirection: "row", justifyContent: "space-between" },
  scoreBoxAutoFail: { backgroundColor: "#fee2e2" },
  scoreLabel: { fontSize: 9, color: "#6b7280" },
  scoreValue: { fontSize: 14, fontWeight: 700 },
  sectionTitle: { fontSize: 11, fontWeight: 700, backgroundColor: "#1e3a8a", color: "#ffffff", padding: 5, marginTop: 10 },
  questionRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingVertical: 4, alignItems: "flex-start" },
  questionLabel: { flex: 1, paddingRight: 8 },
  questionAnswer: { width: 60, textAlign: "center", fontWeight: 700 },
  remarksBox: { marginTop: 14, padding: 10, backgroundColor: "#f9fafb", borderRadius: 4 },
  remarksLabel: { fontSize: 9, color: "#6b7280", marginBottom: 3 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#9ca3af", textAlign: "center" },
});

function answerLabel(value: string | undefined): string {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  if (value === "na") return "N/A";
  return "—";
}

function AuditPdfDocument({ audit }: { audit: QaAuditRecord }) {
  const definition = getAuditDefinition(audit.auditType);
  const answerByKey = new Map(audit.answers.map((a) => [a.questionKey, a.value]));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{QA_AUDIT_TYPE_LABELS[audit.auditType]}</Text>
        <Text style={styles.subtitle}>{definition.sourceFormName}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Agent</Text>
          <Text style={styles.metaValue}>{audit.agentName}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Period</Text>
          <Text style={styles.metaValue}>{audit.periodLabel}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Audit date</Text>
          <Text style={styles.metaValue}>{formatDate(audit.auditDate)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Auditor</Text>
          <Text style={styles.metaValue}>{audit.auditorName}</Text>
        </View>
        {audit.caseReference && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Case reference</Text>
            <Text style={styles.metaValue}>{audit.caseReference}</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Status</Text>
          <Text style={styles.metaValue}>{audit.status === "published" ? "Published" : "Submitted"}</Text>
        </View>

        <View style={audit.autoFail ? [styles.scoreBox, styles.scoreBoxAutoFail] : styles.scoreBox}>            <Text style={styles.scoreLabel}>Score</Text>
            <Text style={styles.scoreValue}>
              {audit.totalPoints}/{audit.applicablePoints} points
              {audit.percentage !== null ? ` (${audit.percentage.toFixed(1)}%)` : ""}
            </Text>
          </View>
          <View>
            <Text style={styles.scoreLabel}>Band</Text>
            <Text style={styles.scoreValue}>
              {audit.band !== null ? `${audit.band} — ${bandLabel(audit.band)}` : "No data"}
            </Text>
          </View>
          {audit.autoFail && (
            <View>
              <Text style={styles.scoreLabel}>Auto-Fail</Text>
              <Text style={styles.scoreValue}>Triggered</Text>
            </View>
          )}
        </View>

        {definition.sections.map((section) => (
          <View key={section.key} wrap={false}>
            <Text style={styles.sectionTitle}>
              {section.title}
              {section.autoFail ? " (zero tolerance — any \u201cNo\u201d fails the whole audit)" : ""}
            </Text>
            {section.questions.map((q) => (
              <View key={q.key} style={styles.questionRow}>
                <Text style={styles.questionLabel}>{q.label}</Text>
                <Text style={styles.questionAnswer}>{answerLabel(answerByKey.get(q.key))}</Text>
              </View>
            ))}
          </View>
        ))}

        {audit.overallRemarks && (
          <View style={styles.remarksBox} wrap={false}>
            <Text style={styles.remarksLabel}>Overall remarks</Text>
            <Text>{audit.overallRemarks}</Text>
          </View>
        )}

        <Text style={styles.footer} fixed>
          Confidential — KYC Team Performance QA Audit. Generated {formatDate(new Date().toISOString())}.
        </Text>
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

    return new NextResponse(buffer, {
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
