"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpDown, Search, CheckCircle2, XCircle } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RankMedal } from "@/components/rankings/RankMedal";
import { gradeTone } from "@/components/dashboard/PerformanceBadge";
import { SCORE_PASS_THRESHOLD } from "@/lib/scoring/thresholds";
import type { Grade } from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

export interface RankingRow {
  agentId: string;
  name: string;
  department: string;
  finalScore: number;
  hasIncompleteData: boolean;
  /** True only when NO metric has data yet this period (as opposed to
   *  hasIncompleteData, which can also mean just one metric is missing).
   *  Renders as a plain "No data" badge instead of a 0.00 score. */
  hasNoData: boolean;
  /** True when SOME data exists but it's under MIN_SCORE_COVERAGE of the
   *  scorecard's total weight (see thresholds.ts) — e.g. only 2 of 6
   *  metrics reported. calculateIndividualScore renormalizes whatever's
   *  present back up to a full 0-3 scale, so a thin, lucky sample can
   *  otherwise renormalize to a perfect score and rank above agents who
   *  reported everything. Renders as "Insufficient data" instead of the
   *  numeric score, and (like hasNoData) is excluded from the ranked
   *  comparison — see the sort below. */
  hasInsufficientData: boolean;
  appAHT: string;
  emailAHT: string;
  chatAvgResponse: string;
  chatFRT: string;
  csatDsat: string;
  /** QA Audit % — missing app-wide today (see MIN_SCORE_COVERAGE in
   *  thresholds.ts), so this column reads "No data" for virtually every
   *  agent right now. Shown anyway rather than omitted, so it's obvious
   *  this metric exists and is simply awaiting real numbers, not silently
   *  left out of the scorecard. */
  qaAudit: string;
  // The 0-3 grade each metric above actually earned against its scoring
  // scale (thresholds.ts bands) -- same value driving that metric's color
  // on the individual Scorecard page, shown here as its own column right
  // next to the raw figure. Null exactly when the raw value above is "—"
  // (no data yet for that metric this period).
  appAHTPoint: Grade | null;
  emailAHTPoint: Grade | null;
  chatAvgResponsePoint: Grade | null;
  chatFRTPoint: Grade | null;
  csatDsatPoint: Grade | null;
  qaAuditPoint: Grade | null;
}

type SortKey = "finalScore" | "name";

const ROW_TINT: Record<number, string> = { 1: "rank-row-gold", 2: "rank-row-silver", 3: "rank-row-bronze" };

/** Agents without enough real data to produce a comparable score — they
 *  still show up in the table (never silently dropped), but never occupy a
 *  ranked position ahead of someone with a genuinely comparable score. */
function isRankable(r: RankingRow): boolean {
  return !r.hasNoData && !r.hasInsufficientData;
}

function scoreCell(r: RankingRow) {
  if (r.hasNoData) return <Badge variant="outline">No data yet</Badge>;
  if (r.hasInsufficientData) return <Badge variant="outline">Insufficient data</Badge>;
  return r.finalScore >= SCORE_PASS_THRESHOLD ? (
    <Badge variant="success">
      <CheckCircle2 className="h-3 w-3" /> {r.finalScore.toFixed(2)}
    </Badge>
  ) : (
    <Badge variant="danger">
      <XCircle className="h-3 w-3" /> {r.finalScore.toFixed(2)}
    </Badge>
  );
}

/** Compact companion cell for a metric's raw-value column -- just the 0-3
 *  grade itself (not the full "Exceptional"/"On Target" label; that's what
 *  GradeBadge is for on the Scorecard detail page, which has room for it).
 *  Same color-by-grade as everywhere else (gradeTone). */
function pointCell(point: Grade | null) {
  if (point === null) return <span className="text-muted-foreground">—</span>;
  return <Badge variant={gradeTone(point) as "primary" | "success" | "warning" | "danger"}>{point}</Badge>;
}

export function RankingTable({ rows, departments }: { rows: RankingRow[]; departments: string[] }) {
  const [query, setQuery] = React.useState("");
  const [department, setDepartment] = React.useState("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("finalScore");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const filteredAll = rows
    .filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
    .filter((r) => department === "all" || r.department === department);

  // Split into two groups rather than one continuous sorted list: agents
  // without enough real data to produce a comparable score (see
  // MIN_SCORE_COVERAGE in thresholds.ts) get their own separate section
  // below, never a numbered rank position ahead of — or interleaved with —
  // someone with a genuinely comparable score.
  const ranked = filteredAll
    .filter(isRankable)
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      return (a[sortKey] - b[sortKey]) * dir;
    });
  const unranked = filteredAll.filter((r) => !isRankable(r)).sort((a, b) => a.name.localeCompare(b.name));

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const isDefaultSort = sortKey === "finalScore" && sortDir === "desc" && department === "all" && query === "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search agent…" className="pl-8" />
        </div>
        <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted-foreground">{filteredAll.length} agents</span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>
                <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("name")}>
                  Agent <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>Department</TableHead>
              <TableHead>App AHT</TableHead>
              <TableHead>Point</TableHead>
              <TableHead>Email AHT</TableHead>
              <TableHead>Point</TableHead>
              <TableHead>Chat Response</TableHead>
              <TableHead>Point</TableHead>
              <TableHead>First Response</TableHead>
              <TableHead>Point</TableHead>
              <TableHead>CSAT</TableHead>
              <TableHead>Point</TableHead>
              <TableHead>QA Audit</TableHead>
              <TableHead>Point</TableHead>
              <TableHead>
                <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("finalScore")}>
                  Score <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranked.map((r, i) => {
              const rank = i + 1;
              // Only tint/medal the true top-3 when the list is showing its natural,
              // unfiltered rank order — a search or re-sort shouldn't crown row #1.
              const showMedal = isDefaultSort && rank <= 3;
              return (
                <TableRow key={r.agentId} className={showMedal ? ROW_TINT[rank] : undefined}>
                  <TableCell>{showMedal ? <RankMedal rank={rank} /> : <RankMedal rank={rank} size="sm" />}</TableCell>
                  <TableCell>
                    <Link href={`/scorecards/${r.agentId}`} className={cn("font-medium text-foreground hover:underline", showMedal && "font-semibold")}>
                      {r.name}
                    </Link>
                    {r.hasIncompleteData && (
                      <Badge variant="outline" className="ml-2">
                        Incomplete
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.department}</TableCell>
                  <TableCell className="text-muted-foreground">{r.appAHT}</TableCell>
                  <TableCell>{pointCell(r.appAHTPoint)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.emailAHT}</TableCell>
                  <TableCell>{pointCell(r.emailAHTPoint)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.chatAvgResponse}</TableCell>
                  <TableCell>{pointCell(r.chatAvgResponsePoint)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.chatFRT}</TableCell>
                  <TableCell>{pointCell(r.chatFRTPoint)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.csatDsat}</TableCell>
                  <TableCell>{pointCell(r.csatDsatPoint)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.qaAudit}</TableCell>
                  <TableCell>{pointCell(r.qaAuditPoint)}</TableCell>
                  <TableCell>{scoreCell(r)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {unranked.length > 0 && (
        <div className="pt-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Not ranked — insufficient data ({unranked.length})
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableBody>
                {unranked.map((r) => (
                  <TableRow key={r.agentId} className="opacity-70">
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell>
                      <Link href={`/scorecards/${r.agentId}`} className="font-medium text-foreground hover:underline">
                        {r.name}
                      </Link>
                      {r.hasIncompleteData && (
                        <Badge variant="outline" className="ml-2">
                          Incomplete
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.department}</TableCell>
                    <TableCell className="text-muted-foreground">{r.appAHT}</TableCell>
                    <TableCell>{pointCell(r.appAHTPoint)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.emailAHT}</TableCell>
                    <TableCell>{pointCell(r.emailAHTPoint)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.chatAvgResponse}</TableCell>
                    <TableCell>{pointCell(r.chatAvgResponsePoint)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.chatFRT}</TableCell>
                    <TableCell>{pointCell(r.chatFRTPoint)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.csatDsat}</TableCell>
                    <TableCell>{pointCell(r.csatDsatPoint)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.qaAudit}</TableCell>
                    <TableCell>{pointCell(r.qaAuditPoint)}</TableCell>
                    <TableCell>{scoreCell(r)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
