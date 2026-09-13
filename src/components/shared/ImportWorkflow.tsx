"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileCheck2, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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

export function ImportWorkflow() {
  const router = useRouter();
  const [phase, setPhase] = React.useState<"idle" | "uploading" | "preview" | "committing" | "done" | "error">("idle");
  const [result, setResult] = React.useState<ParseResponse | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setPhase("uploading");
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/parse", { method: "POST", body: formData });
      const data: ParseResponse = await res.json();
      if (!res.ok) {
        const base = data.error ?? "Failed to parse PDF.";
        setErrorMsg(data.detail ? `${base} (${data.detail})` : base);
        setPhase("error");
        return;
      }
      setResult(data);
      setPhase("preview");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error.");
      setPhase("error");
    }
  }

  async function handleCommit() {
    if (!result) return;
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
          gate: result.gate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Failed to commit import.");
        setPhase("error");
        return;
      }
      setPhase("done");
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
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
          >
            {phase === "uploading" ? (
              <>
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary-500" />
                <p className="text-sm font-medium text-foreground">Reading PDF…</p>
              </>
            ) : (
              <>
                <UploadCloud className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Drag a KYC Team Performance Report PDF here</p>
                <p className="mt-1 text-xs text-muted-foreground">or click to browse — text-based PDFs only</p>
                <Button className="mt-4" onClick={() => fileInputRef.current?.click()}>
                  Choose file
                </Button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
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
