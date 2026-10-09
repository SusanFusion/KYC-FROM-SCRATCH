import { NextResponse } from "next/server";
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { requireActionAccess } from "@/lib/auth/actionAccess";
import { listRawDataChanges } from "@/lib/data/rawDataChangeLog";
import type { RawDataChange } from "@/lib/data/rawDataFields";
import {
  describeFieldChanges,
  filterChanges,
  formatStamp,
  pdfSafe,
  safeTimeZone,
  summarizeChanges,
} from "@/lib/data/rawDataHistoryPdf";
import { describeError } from "@/lib/utils";

export const runtime = "nodejs";

// The Raw Data page's "Export PDF" button. Same approach (and same
// Lead/Manager password check) as the QA audit PDF route: @react-pdf/renderer
// builds the file directly in Node, so it works on Vercel with no headless
// browser. Optional query: ?agent=<name text> limits it to matching agents
// (the same filter box the page uses), ?tz=<IANA zone> prints times in the
// viewer's own time zone.

const INK = "#1f2937";
const MUTED = "#6b7280";
const HAIRLINE = "#e5e7eb";
const PRIMARY = "#1d4ed8";
const PRIMARY_SOFT = "#eff6ff";
const DANGER = "#b91c1c";
const DANGER_SOFT = "#fef2f2";

const styles = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 46, paddingHorizontal: 34, fontSize: 9.5, fontFamily: "Helvetica", color: INK },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 6, backgroundColor: PRIMARY },

  title: { fontSize: 18, fontWeight: 700, color: INK },
  subtitle: { fontSize: 9, color: MUTED, marginTop: 3 },

  summaryRow: { flexDirection: "row", marginTop: 12, marginBottom: 14 },
  summaryBox: {
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginRight: 10,
    minWidth: 84,
  },
  summaryValue: { fontSize: 15, fontWeight: 700, color: INK },
  summaryLabel: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 },

  card: { borderWidth: 1, borderColor: HAIRLINE, borderRadius: 8, padding: 10, marginBottom: 8 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLeft: { flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 8 },
  pill: { borderRadius: 8, paddingVertical: 2.5, paddingHorizontal: 7, marginRight: 7 },
  pillText: { fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 },
  who: { fontSize: 10.5, fontWeight: 700, color: INK },
  when: { fontSize: 8, color: MUTED, textAlign: "right" },

  reasonBox: { backgroundColor: "#f9fafb", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 9, marginTop: 7 },
  reasonLabel: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 },
  reasonText: { fontSize: 9.5, color: INK, lineHeight: 1.4 },

  changesWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  changeItem: { width: "50%", fontSize: 8.5, color: MUTED, paddingRight: 8, marginTop: 2 },

  empty: { fontSize: 10, color: MUTED, marginTop: 10 },

  footer: { position: "absolute", bottom: 20, left: 34, right: 34, fontSize: 7.5, color: MUTED },
  pageNumber: { position: "absolute", bottom: 20, right: 34, fontSize: 7.5, color: MUTED },
});

function HistoryPdfDocument({
  changes,
  agentFilter,
  timeZone,
  generatedAt,
}: {
  changes: RawDataChange[];
  agentFilter: string;
  timeZone: string;
  generatedAt: string;
}) {
  const summary = summarizeChanges(changes);
  const newest = changes[0];
  const oldest = changes[changes.length - 1];

  return (
    <Document title="Raw Data change history">
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} fixed />

        <Text style={styles.title}>Raw Data change history</Text>
        <Text style={styles.subtitle}>
          {agentFilter ? `Agent filter: "${pdfSafe(agentFilter)}"  |  ` : "All agents  |  "}
          {newest && oldest ? `${formatStamp(oldest.createdAt, timeZone)} to ${formatStamp(newest.createdAt, timeZone)}  |  ` : ""}
          Generated {formatStamp(generatedAt, timeZone)}
        </Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryValue}>{summary.total}</Text>
            <Text style={styles.summaryLabel}>Changes</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryValue}>{summary.edits}</Text>
            <Text style={styles.summaryLabel}>Edits</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryValue}>{summary.deletions}</Text>
            <Text style={styles.summaryLabel}>Deletions</Text>
          </View>
        </View>

        {changes.length === 0 && <Text style={styles.empty}>No changes recorded.</Text>}

        {changes.map((c) => {
          const isDelete = c.action === "delete";
          const lines = describeFieldChanges(c);
          return (
            <View key={c.id} style={styles.card} wrap={false}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <View style={[styles.pill, { backgroundColor: isDelete ? DANGER_SOFT : PRIMARY_SOFT }]}>
                    <Text style={[styles.pillText, { color: isDelete ? DANGER : PRIMARY }]}>{isDelete ? "Deleted" : "Edited"}</Text>
                  </View>
                  <Text style={styles.who}>
                    {pdfSafe(c.agentName)} - {c.date}
                  </Text>
                </View>
                <Text style={styles.when}>
                  by {pdfSafe(c.changedBy)}  |  {formatStamp(c.createdAt, timeZone)}
                </Text>
              </View>

              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>{isDelete ? "Reason for deletion" : "Reason for edit"}</Text>
                <Text style={styles.reasonText}>{pdfSafe(c.reason) || "(none recorded)"}</Text>
              </View>

              {lines.length > 0 && (
                <View style={styles.changesWrap}>
                  {lines.map((line, i) => (
                    <Text key={i} style={styles.changeItem}>
                      {pdfSafe(line)}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <Text style={styles.footer} fixed>
          Confidential - KYC Team Performance. Every edit and deletion made on the Raw Data page, with who made it and why.
        </Text>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}

export async function GET(request: Request) {
  const denied = await requireActionAccess();
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const agent = (url.searchParams.get("agent") ?? "").trim();
    const timeZone = safeTimeZone(url.searchParams.get("tz"));

    const all = await listRawDataChanges(2000);
    const changes = filterChanges(all, agent);

    const buffer = await renderToBuffer(
      <HistoryPdfDocument changes={changes} agentFilter={agent} timeZone={timeZone} generatedAt={new Date().toISOString()} />
    );
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="raw-data-change-history-${stamp}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error while generating the PDF.", detail: describeError(err) }, { status: 500 });
  }
}
