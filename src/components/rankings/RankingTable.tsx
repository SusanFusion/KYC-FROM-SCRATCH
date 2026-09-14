"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpDown, Search, CheckCircle2, XCircle } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RankMedal } from "@/components/rankings/RankMedal";
import { SCORE_PASS_THRESHOLD } from "@/lib/scoring/thresholds";
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
  appAHT: string;
  emailAHT: string;
  chatAvgResponse: string;
  chatFRT: string;
  csatDsat: string;
}

type SortKey = "finalScore" | "name";

const ROW_TINT: Record<number, string> = { 1: "rank-row-gold", 2: "rank-row-silver", 3: "rank-row-bronze" };

export function RankingTable({ rows, departments }: { rows: RankingRow[]; departments: string[] }) {
  const [query, setQuery] = React.useState("");
  const [department, setDepartment] = React.useState("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("finalScore");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const filtered = rows
    .filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
    .filter((r) => department === "all" || r.department === department)
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      return (a[sortKey] - b[sortKey]) * dir;
    });

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
        <span className="text-xs text-muted-foreground">{filtered.length} agents</span>
      </div>

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
            <TableHead>Email AHT</TableHead>
            <TableHead>Chat Response</TableHead>
            <TableHead>First Response</TableHead>
            <TableHead>CSAT</TableHead>
            <TableHead>
              <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("finalScore")}>
                Score <ArrowUpDown className="h-3 w-3" />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r, i) => {
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
                <TableCell className="text-muted-foreground">{r.emailAHT}</TableCell>
                <TableCell className="text-muted-foreground">{r.chatAvgResponse}</TableCell>
                <TableCell className="text-muted-foreground">{r.chatFRT}</TableCell>
                <TableCell className="text-muted-foreground">{r.csatDsat}</TableCell>
                <TableCell>
                  {r.hasNoData ? (
                    <Badge variant="outline">No data yet</Badge>
                  ) : r.finalScore >= SCORE_PASS_THRESHOLD ? (
                    <Badge variant="success">
                      <CheckCircle2 className="h-3 w-3" /> {r.finalScore.toFixed(2)}
                    </Badge>
                  ) : (
                    <Badge variant="danger">
                      <XCircle className="h-3 w-3" /> {r.finalScore.toFixed(2)}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
