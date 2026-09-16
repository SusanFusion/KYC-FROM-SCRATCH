import { NextResponse } from "next/server";
import { loadPeriodDataset } from "@/lib/data/query";
import { generatePeriodReportHtml } from "@/lib/reports/generateReportHtml";
import { requireActionAccess } from "@/lib/auth/actionAccess";

export const dynamic = "force-dynamic";

/**
 * Serves the single-period snapshot report as a downloadable, self-contained
 * HTML file (inline CSS only) so it opens correctly as an email attachment
 * or a standalone double-clicked file — not just inside this app.
 */
export async function GET(request: Request) {
  const denied = await requireActionAccess();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const periodId = searchParams.get("periodId") ?? undefined;

  const dataset = await loadPeriodDataset(periodId);
  // Used to key QA Audit restriction off the signed-in user's role
  // (user?.role !== "lead"), back when reaching this route at all required
  // being signed in as SOMEONE. Now it requires the shared Lead/Manager
  // action password instead (requireActionAccess above) — a stronger gate
  // than the old per-user session ever was, since agents never had that
  // password to begin with — so the export is unrestricted once past it,
  // same as every other Lead/Manager-only action in this app.
  const html = generatePeriodReportHtml(dataset, { restrictQaAudit: false });

  const slug = (dataset.period?.label ?? "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="kyc-performance-report-${slug || "snapshot"}.html"`,
      "Cache-Control": "no-store",
    },
  });
}
