"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileCheck2, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface PeriodOption {
  id: string;
  label: string;
  endDate: string;
}

const NEW_PERIOD_VALUE = "__new__";

/** The PDF's own "Generated Date:" text is read verbatim as DD-MM-YYYY —
 *  converts it to the YYYY-MM-DD a plain <input type="date"> needs, so the
 *  date field can start pre-filled with the app's best guess instead of
 *  blank. Returns null (rather than guessing) for anything that doesn't
 *  match that exact shape, so a garbled or missing date never silently
 *  becomes a wrong one — the caller falls back to today instead. */
function guessToIso(guess: string | null): string | null {
  if (!guess) return null;
  const m = guess.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

interface ParsedRow {
  id?: string;
  agentNameRaw: string;
  matchedAgentId: string | null;
  metricKey: string;
  rawValue: string;
  parsedValue: number | null;
  status: "extracted" | "needs_review" | "failed";
  note?: string;
}

interface ParseResponse {
  importId: string;
  rows: ParsedRow[];
  gate: Record<string, number | null>;
  gateFieldsFound: string[];
  tablesDetected: string[];
  periodLabelGuess: string | null;
  generatedDateGuess: string | null;
  warnings: string[];
  error?: string;
  detail?: string;
}

const STATUS_META: Record<ParsedRow["status"], { label: string; variant: "success" | "warning" | "danger"; Icon: typeof CheckCircle2 }> = {
  extracted: { label: "Extracted", variant: "success", Icon: CheckCircle2 },
  needs_review: { label: "Needs review", variant: "warning", Icon: AlertTriangle },
  failed: { label: "Failed", variant: "danger", Icon: XCircle },
};

export function ImportWorkflow({ periods }: { periods: PeriodOption[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [phase, setPhase] = React.useState<"idle" | "uploading" | "preview" | "committing" | "done" | "error">("idle");
  const [result, setResult] = React.useState<ParseResponse | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  // Defaults to the current period so this PDF's numbers land on the same
  // period any earlier import/manual entry already established, instead of
  // silently starting a second period the dashboard never shows.
  const [targetPeriodId, setTargetPeriodId] = React.useState<string>(periods[0]?.id ?? NEW_PERIOD_VALUE);
  // The date this data is actually for — pre-filled from whatever the PDF's
  // own "Generated Date:" text says (once parsed), but always visible and
  // editable before committing, so a misread or backlogged-day import never
  // silently lands on the wrong date (see the Data Import date-confusion
  // fix in notes.ts).
  const [reportDate, setReportDate] = React.useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isNewPeriod = targetPeriodId === NEW_PERIOD_VALUE;
  const selectedExistingPeriod = periods.find((p) => p.id === targetPeriodId);

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setPhase("uploading");
    setErrorMsg(null);
    try {
      const formData = new FormData();
      for (const file of files) formData.append("file", file);
      const res = await fetch("/api/import/parse", { method: "POST", body: formData });
      const data: ParseResponse = await res.json();
      if (!res.ok) {
        const base = data.error ?? "Failed to parse PDF.";
        setErrorMsg(data.detail ? `${base} (${data.detail})` : base);
        setPhase("error");
        return;
      }
      setResult(data);
      setReportDate(guessToIso(data.generatedDateGuess) ?? new Date().toISOString().slice(0, 10));
      setPhase("preview");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error.");
      setPhase("error");
    }
  }

  async function handleCommit() {
    if (!result) return;
    if (isNewPeriod && !reportDate) {
      setErrorMsg("Pick the date this data is for before importing.");
      setPhase("error");
      return;
    }
    setPhase("committing");
    try {
      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importId: result.importId,
          rows: result.rows,
          periodLabel: result.periodLabelGuess,
          generatedDateGuess: result.generatedDateGuess,
          endDateIso: reportDate,
          gate: result.gate,
          targetPeriodId: targetPeriodId === NEW_PERIOD_VALUE ? null : targetPeriodId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Failed to commit import.");
        setPhase("error");
        return;
      }
      setPhase("done");
      const agentsUpdated = typeof data.agentsUpdated === "number" ? data.agentsUpdated : null;
      const periodLabel = data.period?.label as string | undefined;
      showToast(
        `Import successful${periodLabel ? ` — ${periodLabel}` : ""}${
          agentsUpdated !== null ? ` (${agentsUpdated} agent${agentsUpdated === 1 ? "" : "s"} updated)` : ""
        }. Dashboard, rankings, and scorecards now reflect this data.`,
        "success"
      );
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error.");
      setPhase("error");
    }
  }

  const counts = React.useMemo(() => {
    if (!result) return { extracted: 0, needs_review: 0, failed: 0 };
    return result.rows.reduce(
      (acc, r) => {
        acc[r.status]++;
        return acc;
      },
      { extracted: 0, needs_review: 0, failed: 0 }
    );
  }, [result]);

  if (phase === "idle" || phase === "uploading") {
    return (
      <Card>
        <CardContent className="p-10">
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-14 text-center transition-colors hover:border-primary-500 hover:bg-primary-50/40"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(Array.from(e.dataTransfer.files ?? []));
            }}
          >
            {phase === "uploading" ? (
              <>
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary-500" />
                <p className="text-sm font-medium text-foreground">Reading PDF(s)…</p>
              </>
            ) : (
              <>
                <UploadCloud className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Drag one or more KYC Team Performance Report PDFs here</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  or click to browse — text-based PDFs only. Upload several at once if they cover different
                  metrics for the same period; they&apos;ll be merged into one import.
                </p>
                <Button className="mt-4" onClick={() => fileInputRef.current?.click()}>
                  Choose file(s)
                </Button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "error") {
    return (
      <Card className="border-danger/30">
        <CardContent className="flex items-start gap-3 p-6">
          <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" />
          <div>
            <p className="text-sm font-medium text-foreground">Import failed</p>
            <p className="mt-1 text-sm text-muted-foreground">{errorMsg}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setPhase("idle")}>
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "done") {
    return (
      <Card className="border-success/30">
        <CardContent className="flex items-start gap-3 p-6">
          <FileCheck2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" />
          <div>
            <p className="text-sm font-medium text-foreground">Import committed</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The dashboard, rankings, and scorecards now reflect this period&apos;s data.
            </p>
            <Button size="sm" className="mt-3" onClick={() => setPhase("idle")}>
              Import another report
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // preview / committing
  if (!result) return null;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Review before import</CardTitle>
          <CardDescription>
            Nothing has been saved yet. Confirm below to commit — rows marked &quot;Failed&quot; are excluded automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Add this data to</label>
              <Select value={targetPeriodId} onChange={(e) => setTargetPeriodId(e.target.value)} className="w-full sm:w-auto">
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                    {p.id === periods[0]?.id ? " (current)" : ""}
                  </option>
                ))}
                <option value={NEW_PERIOD_VALUE}>+ Start a new period{result.periodLabelGuess ? ` (${result.periodLabelGuess})` : ""}</option>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Merging into an existing period only adds/updates what this PDF actually contains — everything else
                already recorded for it stays as it was.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Date this data is for</label>
              {isNewPeriod ? (
                <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="w-full sm:w-auto" />
              ) : (
                <Input type="date" value={selectedExistingPeriod?.endDate ?? reportDate} disabled className="w-full opacity-70 sm:w-auto" />
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {isNewPeriod
                  ? result.generatedDateGuess
                    ? `Detected "Generated Date: ${result.generatedDateGuess}" in the PDF — confirm or correct it here.`
                    : "No date was detected in the PDF — pick the date this report actually covers."
                  : "Fixed to the date already on record for the period selected above."}
              </p>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="success">{counts.extracted} extracted</Badge>
            <Badge variant="warning">{counts.needs_review} needs review</Badge>
            <Badge variant="danger">{counts.failed} failed</Badge>
            <Badge variant="outline">Tables detected: {result.tablesDetected.join(", ") || "none"}</Badge>
            {result.periodLabelGuess && <Badge variant="outline">Period: {result.periodLabelGuess}</Badge>}
          </div>
          {result.warnings.length > 0 && (
            <div className="mb-4 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              {result.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent (as read)</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>Raw value</TableHead>
                <TableHead>Parsed</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row, i) => {
                const meta = STATUS_META[row.status];
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-foreground">
                      {row.agentNameRaw}
                      {!row.matchedAgentId && <span className="ml-1 text-xs text-warning">(unmatched)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.metricKey}</TableCell>
                    <TableCell className="text-muted-foreground">{row.rawValue || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.parsedValue ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>
                        <meta.Icon className="h-3 w-3" /> {meta.label}
                      </Badge>
                      {row.note && <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleCommit} disabled={phase === "committing"}>
          {phase === "committing" ? "Committing…" : "Confirm & Import"}
        </Button>
        <Button variant="outline" onClick={() => setPhase("idle")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
