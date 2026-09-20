"use client";

import * as React from "react";
import { CalendarDays, BarChart3, FileSpreadsheet, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { WeekOption, MonthOption } from "@/lib/data/query";
import { monthKey } from "@/lib/data/dateRanges";

export function ReportExportPicker({ weeks, months }: { weeks: WeekOption[]; months: MonthOption[] }) {
  const [mtdMonth, setMtdMonth] = React.useState(months[0]?.key ?? "");
  const [weeklyMonth, setWeeklyMonth] = React.useState(months[0]?.key ?? "");
  const [weeklyWeek, setWeeklyWeek] = React.useState(weeks[0]?.start ?? "");
  const [excelMonth, setExcelMonth] = React.useState(months[0]?.key ?? "");

  const weeksInMonth = weeks.filter((w) => monthKey(w.start) === weeklyMonth);
  // If the month dropdown no longer contains the currently-selected week
  // (the person just switched months), fall back to that month's most
  // recent week rather than pointing the Export button at a stale,
  // no-longer-visible option.
  const effectiveWeek = weeksInMonth.some((w) => w.start === weeklyWeek) ? weeklyWeek : weeksInMonth[0]?.start ?? "";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card className="border-primary-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary-700">
            <CalendarDays className="h-4 w-4" /> MTD Report
          </CardTitle>
          <CardDescription>
            Month-to-date full performance report with trend charts, rankings, streaks, and alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Month</label>
            <Select value={mtdMonth} onChange={(e) => setMtdMonth(e.target.value)} disabled={months.length === 0}>
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
            <Badge variant="outline">Coming soon</Badge>
            <span className="text-xs text-muted-foreground">Trend charts, streaks, and alerts are still being built.</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-success/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-success">
            <BarChart3 className="h-4 w-4" /> Weekly Report
          </CardTitle>
          <CardDescription>
            Week-by-week snapshot — rankings, QA audits, penalties, coach watch &amp; week-over-week gate
            comparison.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Month</label>
            <Select value={weeklyMonth} onChange={(e) => setWeeklyMonth(e.target.value)} disabled={months.length === 0}>
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">Week</label>
            <Select value={effectiveWeek} onChange={(e) => setWeeklyWeek(e.target.value)} disabled={weeksInMonth.length === 0}>
              {weeksInMonth.length === 0 ? (
                <option value="">No weeks imported this month</option>
              ) : (
                weeksInMonth.map((w) => (
                  <option key={w.start} value={w.start}>
                    Week of {w.label}
                  </option>
                ))
              )}
            </Select>
            {weeksInMonth.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {weeks.find((w) => w.start === effectiveWeek)?.label}
              </p>
            )}
          </div>
          <a
            href={effectiveWeek ? `/api/reports/export?type=weekly&week=${encodeURIComponent(effectiveWeek)}` : undefined}
            download
            aria-disabled={!effectiveWeek}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors ${
              effectiveWeek ? "bg-success hover:bg-success/90" : "pointer-events-none bg-muted text-muted-foreground"
            }`}
          >
            <Download className="h-4 w-4" /> Export Week →
          </a>
        </CardContent>
      </Card>

      <Card className="sm:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary-600" /> KYC KPI Summary Excel
          </CardTitle>
          <CardDescription>
            Formatted .xlsx with actual values, grades, weighted scores, and penalty breakdown — every KYC agent.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-56">
            <Select value={excelMonth} onChange={(e) => setExcelMonth(e.target.value)} disabled={months.length === 0}>
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Coming soon</Badge>
            <span className="text-xs text-muted-foreground">The formatted .xlsx export is still being built.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
