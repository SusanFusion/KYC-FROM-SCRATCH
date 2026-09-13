import { NextResponse } from "next/server";
import { loadPeriodDataset } from "@/lib/data/query";
import { generatePeriodReportHtml } from "@/lib/reports/generateReportHtml";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export const dynamic = "force-dynamic";

/**
 * Serves the single-period snapshot report as a downloadable, self-contained
 * HTML file (inline CSS only) so it opens correctly as an email attachment
 * or a standalone double-clicked file — not just inside this app.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const periodId = searchParams.get("periodId") ?? undefined;

  const [dataset, user] = await Promise.all([loadPeriodDataset(periodId), getCurrentUser()]);
  // Defensive default is "restrict" — only an explicit Lead/Manager session
  // gets the unrestricted export (middleware already requires SOME session
  // to reach this route at all).
  const html = generatePeriodReportHtml(dataset, { restrictQaAudit: user?.role !== "lead" });

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
