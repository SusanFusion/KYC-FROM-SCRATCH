/* eslint-disable no-console */
// Verifies the PDF import parser against the ACTUAL source PDF (not a
// synthetic fixture), end-to-end: extract text geometry with pdfjs-dist,
// run it through parseKycReportPages, and cross-check the reconstructed
// values against the same seed data used elsewhere in the app.
//
// NOTE: this script locates pdfjs-dist via an absolute path because it is
// only available globally in this sandbox (network access to the npm
// registry is blocked here — see the PR/session notes). In the real
// project, src/app/api/import/parse/route.ts imports it normally as
// "pdfjs-dist/legacy/build/pdf.mjs" once `npm install` has run.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseKycReportPages, type PageTextItem } from "../src/lib/data/pdfImportParser";
import { SEED_AGENTS } from "../src/lib/data/seed/agents";
import { buildSeedRawMetrics } from "../src/lib/data/seed/rawMetrics";

const PDFJS_PATH = "/home/claude/.npm-global/lib/node_modules/pdfjs-dist/legacy/build/pdf.mjs";
const SOURCE_PDF =
  "/root/.claude/uploads/0dd86b06-5b62-511e-aec9-2699ec2f4343/2669f41a-daily_kyc_team_performance_report_88419.pdf";

async function main() {
  const pdfjsLib = await import(PDFJS_PATH);
  const data = new Uint8Array(await readFile(SOURCE_PDF));
  const doc = await pdfjsLib.getDocument({ data }).promise;

  const pages: PageTextItem[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items.map((it: any) => ({
        str: it.str,
        x: Math.round(it.transform[4]),
        y: Math.round(it.transform[5]),
      }))
    );
  }

  const result = parseKycReportPages(pages, SEED_AGENTS);

  console.log(`Tables detected: ${result.tablesDetected.join(", ")}`);
  console.log(`Gate fields found: ${result.gateFieldsFound.join(", ")}`);
  console.log(`Period label guess: ${result.periodLabelGuess}`);
  console.log(`Generated date guess: ${result.generatedDateGuess}`);
  console.log(`Rows extracted: ${result.rows.length}`);
  console.log(`Warnings: ${result.warnings.length ? result.warnings.join(" | ") : "none"}`);

  const failed = result.rows.filter((r) => r.status === "failed");
  const needsReview = result.rows.filter((r) => r.status === "needs_review");
  console.log(`Failed: ${failed.length}, Needs review: ${needsReview.length}`);
  if (failed.length) console.log("Failed rows:", JSON.stringify(failed, null, 2));
  if (needsReview.length) console.log("Needs-review rows:", JSON.stringify(needsReview, null, 2));

  assert.equal(result.tablesDetected.length, 4, "expected all 4 individual-metric tables to be detected");
  assert.equal(failed.length, 0, "no row should fail to parse against the real PDF");
  assert.equal(needsReview.length, 0, "every agent name in the PDF should match the seeded roster");

  // Cross-check reconstructed values against the hand-transcribed seed —
  // they must match exactly, proving the geometry-based parser reconstructs
  // the same numbers a human transcribing the PDF would.
  const seedMetrics = buildSeedRawMetrics();
  const byAgent = new Map(seedMetrics.map((m) => [m.agentId, m]));

  const fieldMap: Record<string, string> = {
    totalChatConversations: "totalChatConversations",
    avgFirstResponseTimeSec: "avgFirstResponseTimeSec",
    avgResponseTimeSec: "avgResponseTimeSec",
    emailAHTSec: "emailAHTSec",
    appAHTSec: "appAHTSec",
    totalChats: "totalChats",
    csatCount: "csatCount",
    dsatCount: "dsatCount",
  };

  let mismatches = 0;
  for (const row of result.rows) {
    if (!row.matchedAgentId) continue;
    const seed = byAgent.get(row.matchedAgentId) as Record<string, number | null> | undefined;
    const seedField = fieldMap[row.metricKey];
    if (!seed || !seedField) continue;
    const expected = seed[seedField];
    if (expected === null || row.parsedValue === null) continue;
    const diff = Math.abs(expected - row.parsedValue);
    if (diff > 0.01) {
      mismatches++;
      console.log(`MISMATCH ${row.matchedAgentId}.${row.metricKey}: expected ${expected}, got ${row.parsedValue}`);
    }
  }
  assert.equal(mismatches, 0, "parsed values must match the hand-transcribed seed exactly");

  console.log("\n✅ PDF import parser reconstructs the real report exactly, matching the seed data.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
