"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2, AlertTriangle, History, Search, XCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { ROSTER } from "@/lib/auth/roster";
import {
  RAW_FIELDS,
  formatRawValue,
  formatRawValuePrecise,
  rawFieldDef,
  type RawDataChange,
  type RawValues,
} from "@/lib/data/rawDataFields";
import { updateRawEntryAction, deleteRawEntryAction, listRawDataChangesAction } from "@/app/raw-data/actions";

export interface RawDataRow {
  key: string;
  date: string;
  agentId: string;
  agentName: string;
  values: RawValues;
  /** True on every row of the most recent imported day. */
  isLatestDate: boolean;
}

const LEADS = ROSTER.filter((r) => r.role === "lead");
const CHANGED_BY_STORAGE_KEY = "kyc-raw-data-changed-by";
const MIN_REASON_LENGTH = 5;

// Frozen header cells: opaque background so rows scrolling underneath don't
// show through, and a shadow instead of a border (borders don't travel with
// sticky cells in a collapsed-border table).
const STICKY_HEAD = "sticky top-0 z-10 bg-muted shadow-[0_1px_0_0_rgba(128,128,128,0.35)]";

function readRememberedLead(): string {
  try {
    const saved = window.localStorage.getItem(CHANGED_BY_STORAGE_KEY);
    if (saved && LEADS.some((l) => l.name === saved)) return saved;
  } catch {
    // storage blocked -- fall through to the default
  }
  return LEADS[0]?.name ?? "";
}

function rememberLead(name: string) {
  try {
    window.localStorage.setItem(CHANGED_BY_STORAGE_KEY, name);
  } catch {
    // a convenience only
  }
}

function dsatPct(values: RawValues): string {
  const { dsatCount, totalChats } = values;
  if (dsatCount === null || totalChats === null || totalChats <= 0) return "—";
  return `${((dsatCount / totalChats) * 100).toFixed(2)}%`;
}

/** Who is making the change + the mandatory reason -- shared by the edit and delete pop-ups. */
function ReasonFields({
  changedBy,
  setChangedBy,
  reason,
  setReason,
  label,
  placeholder,
  disabled,
}: {
  changedBy: string;
  setChangedBy: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  label: string;
  placeholder: string;
  disabled: boolean;
}) {
  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Changed by</label>
        <Select value={changedBy} onChange={(e) => setChangedBy(e.target.value)} className="w-full" disabled={disabled}>
          {LEADS.map((l) => (
            <option key={l.email} value={l.name}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-warning">
          <AlertTriangle className="h-3.5 w-3.5" /> {label} <span className="text-danger">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full rounded-md border border-warning/60 bg-card p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
      <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function EditEntryForm({ row, onCancel, onSaved }: { row: RawDataRow; onCancel: () => void; onSaved: () => void | Promise<void> }) {
  const { showToast } = useToast();
  const [texts, setTexts] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of RAW_FIELDS) {
      const v = row.values[f.key];
      initial[f.key] = v === null ? "" : String(v);
    }
    return initial;
  });
  const [changedBy, setChangedBy] = React.useState(LEADS[0]?.name ?? "");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setChangedBy(readRememberedLead());
  }, []);

  async function handleSave() {
    if (saving) return;
    setError(null);
    if (reason.trim().length < MIN_REASON_LENGTH) {
      setError("Please explain why this data is being changed — a reason is required.");
      return;
    }
    const values: Record<string, number | null> = {};
    for (const f of RAW_FIELDS) {
      const text = (texts[f.key] ?? "").trim();
      if (text === "") {
        values[f.key] = null;
        continue;
      }
      const n = Number(text);
      if (!Number.isFinite(n)) {
        setError(`${f.label}: "${text}" isn't a number.`);
        return;
      }
      values[f.key] = n;
    }
    setSaving(true);
    try {
      const result = await updateRawEntryAction({ agentId: row.agentId, date: row.date, values, reason, changedBy });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      rememberLead(changedBy);
      showToast(`Saved — ${row.agentName}'s entry for ${row.date} was updated and the change was recorded.`, "success");
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</label>
          <Input value={row.date} disabled />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Agent name</label>
          <Input value={row.agentName} disabled />
        </div>
        {RAW_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.label}</label>
            <Input
              type="number"
              inputMode="decimal"
              step={f.kind === "count" ? "1" : "any"}
              min={0}
              value={texts[f.key] ?? ""}
              onChange={(e) => setTexts((prev) => ({ ...prev, [f.key]: e.target.value }))}
              placeholder="No data"
              disabled={saving}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Leave a box empty to mark that KPI as &ldquo;no data&rdquo; for this day.</p>

      <ReasonFields
        changedBy={changedBy}
        setChangedBy={setChangedBy}
        reason={reason}
        setReason={setReason}
        label="Reason for edit"
        placeholder="Required — explain why this data is being changed…"
        disabled={saving}
      />

      {error && <ErrorBanner message={error} />}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function DeleteEntryForm({ row, onCancel, onDeleted }: { row: RawDataRow; onCancel: () => void; onDeleted: () => void | Promise<void> }) {
  const { showToast } = useToast();
  const [changedBy, setChangedBy] = React.useState(LEADS[0]?.name ?? "");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    setChangedBy(readRememberedLead());
  }, []);

  const filled = RAW_FIELDS.filter((f) => row.values[f.key] !== null);

  async function handleDelete() {
    if (deleting) return;
    setError(null);
    if (reason.trim().length < MIN_REASON_LENGTH) {
      setError("Please explain why this entry is being deleted — a reason is required.");
      return;
    }
    setDeleting(true);
    try {
      const result = await deleteRawEntryAction({ agentId: row.agentId, date: row.date, reason, changedBy });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      rememberLead(changedBy);
      showToast(`Deleted — ${row.agentName}'s entry for ${row.date} was removed and the deletion was recorded.`, "success");
      await onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm">
        <p className="font-medium text-foreground">
          {row.agentName} · {row.date}
        </p>
        <p className="mt-1 text-muted-foreground">
          This removes the agent&apos;s whole entry for this day ({filled.length} recorded value{filled.length === 1 ? "" : "s"}:{" "}
          {filled.map((f) => `${f.short} ${formatRawValue(f.kind, row.values[f.key])}`).join(", ")}). Scorecards, rankings and
          every average that used it update straight away. The values stay in the change history below.
        </p>
      </div>

      <ReasonFields
        changedBy={changedBy}
        setChangedBy={setChangedBy}
        reason={reason}
        setReason={setReason}
        label="Reason for deletion"
        placeholder="Required — explain why this entry is being deleted…"
        disabled={deleting}
      />

      {error && <ErrorBanner message={error} />}

      <div className="flex gap-2">
        <Button variant="danger" onClick={handleDelete} disabled={deleting} className="flex-1">
          {deleting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
            </>
          ) : (
            "Delete entry"
          )}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={deleting} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ChangeHistory({ changes, loadError, filter }: { changes: RawDataChange[] | null; loadError: string | null; filter: string }) {
  const { showToast } = useToast();
  const [showAll, setShowAll] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const needle = filter.trim().toLowerCase();
  const visible = (changes ?? []).filter((c) => !needle || c.agentName.toLowerCase().includes(needle));
  const shown = showAll ? visible : visible.slice(0, 15);

  // Downloads the whole history (not just the 15 shown) as a PDF -- limited to
  // the agent in the filter box, if one is typed -- using the same times as
  // this page (the browser's own time zone is sent along).
  async function handleExportPdf() {
    if (exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (needle) params.set("agent", filter.trim());
      try {
        params.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
      } catch {
        // the server falls back to UTC
      }
      const res = await fetch(`/api/raw-data/history-pdf?${params.toString()}`);
      if (!res.ok) {
        let message = "Couldn't create the PDF.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // keep the generic message
        }
        showToast(message, "error");
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `raw-data-change-history-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      showToast("Change history PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't create the PDF.", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Change history
          </CardTitle>
          <CardDescription>
            Every edit and deletion made on this page, with who made it and the reason they gave. Entries are never removed from this list.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPdf}
          disabled={exporting || visible.length === 0}
          title={needle ? "Export the history for the filtered agent as a PDF" : "Export the full change history as a PDF"}
        >
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {exporting ? "Creating PDF…" : "Export PDF"}
        </Button>
      </CardHeader>
      <CardContent>
        {loadError ? (
          <ErrorBanner message={loadError} />
        ) : changes === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
          </p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes recorded{needle ? " for that agent" : " yet"}.</p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {shown.map((c) => (
                <li key={c.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={c.action === "delete" ? "danger" : "primary"}>{c.action === "delete" ? "Deleted" : "Edited"}</Badge>
                    <span className="font-medium text-foreground">
                      {c.agentName} · {c.date}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      by {c.changedBy} · {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1.5 rounded-md bg-muted/50 px-3 py-2 text-foreground">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Reason: </span>
                    {c.reason}
                  </p>
                  {c.changes.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {c.changes.map((ch) => {
                        const def = rawFieldDef(ch.field);
                        const kind = def?.kind ?? "count";
                        return (
                          <li key={ch.field}>
                            <span className="font-medium text-foreground">{ch.label}:</span> {formatRawValuePrecise(kind, ch.from)} →{" "}
                            {formatRawValuePrecise(kind, ch.to)}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            {visible.length > 15 && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowAll((s) => !s)}>
                {showAll ? "Show fewer" : `Show all ${visible.length}`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function RawDataWorkspace({ rows, monthLabel }: { rows: RawDataRow[]; monthLabel: string }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState("");
  const [editing, setEditing] = React.useState<RawDataRow | null>(null);
  const [deleting, setDeleting] = React.useState<RawDataRow | null>(null);
  const [changes, setChanges] = React.useState<RawDataChange[] | null>(null);
  const [historyError, setHistoryError] = React.useState<string | null>(null);

  const loadHistory = React.useCallback(async () => {
    try {
      const result = await listRawDataChangesAction();
      if (result.ok) {
        setChanges(result.changes);
        setHistoryError(null);
      } else {
        setHistoryError(result.error);
      }
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Couldn't load the change history.");
    }
  }, []);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function afterChange() {
    setEditing(null);
    setDeleting(null);
    router.refresh();
    await loadHistory();
  }

  const needle = filter.trim().toLowerCase();
  const visibleRows = rows.filter((r) => !needle || r.agentName.toLowerCase().includes(needle));

  return (
    <>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>All agent entries · {monthLabel}</CardTitle>
            <CardDescription>
              {visibleRows.length} entr{visibleRows.length === 1 ? "y" : "ies"} — one row per agent per day, showing the values every
              score is built from. Edit or delete a row; a reason is required for both.
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Filter by agent name…" value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-8" />
          </div>
        </CardHeader>
        <CardContent>
          {visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries match.</p>
          ) : (
            // Own scroll box (instead of the shared <Table>, whose wrapper only
            // scrolls sideways): the table scrolls up/down inside the card, so
            // the header row below can stay frozen while the rows move.
            <div className="max-h-[calc(100vh-15rem)] min-h-[16rem] w-full overflow-auto scrollbar-thin rounded-lg border border-border">
              <table className="w-full caption-bottom text-sm">
              <thead>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={STICKY_HEAD}>Date</TableHead>
                  <TableHead className={STICKY_HEAD}>Agent</TableHead>
                  {RAW_FIELDS.slice(0, 6).map((f) => (
                    <TableHead key={f.key} className={STICKY_HEAD}>
                      {f.short}
                    </TableHead>
                  ))}
                  <TableHead className={STICKY_HEAD}>Total Chats</TableHead>
                  <TableHead className={STICKY_HEAD}>CSAT</TableHead>
                  <TableHead className={STICKY_HEAD}>DSAT</TableHead>
                  <TableHead className={STICKY_HEAD}>DSAT %</TableHead>
                  <TableHead className={STICKY_HEAD}>QA %</TableHead>
                  <TableHead className={`${STICKY_HEAD} text-right`}>Actions</TableHead>
                </TableRow>
              </thead>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="whitespace-nowrap">
                      {row.date}
                      {row.isLatestDate && (
                        <Badge variant="success" className="ml-2 text-[10px]">
                          Latest
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium text-foreground">{row.agentName}</TableCell>
                    {RAW_FIELDS.slice(0, 6).map((f) => (
                      <TableCell key={f.key} className="whitespace-nowrap tabular-nums">
                        {formatRawValue(f.kind, row.values[f.key])}
                      </TableCell>
                    ))}
                    <TableCell className="tabular-nums">{formatRawValue("count", row.values.totalChats)}</TableCell>
                    <TableCell className="tabular-nums">{formatRawValue("count", row.values.csatCount)}</TableCell>
                    <TableCell className="tabular-nums">{formatRawValue("count", row.values.dsatCount)}</TableCell>
                    <TableCell className="tabular-nums">{dsatPct(row.values)}</TableCell>
                    <TableCell className="tabular-nums">{formatRawValue("percent", row.values.qaAuditPct)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>{" "}
                      <Button size="sm" variant="outline" className="text-danger hover:text-danger" onClick={() => setDeleting(row)}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ChangeHistory changes={changes} loadError={historyError} filter={filter} />

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title="Edit Agent Entry"
      >
        {editing && <EditEntryForm key={editing.key} row={editing} onCancel={() => setEditing(null)} onSaved={afterChange} />}
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete this entry?"
      >
        {deleting && <DeleteEntryForm key={deleting.key} row={deleting} onCancel={() => setDeleting(null)} onDeleted={afterChange} />}
      </Dialog>
    </>
  );
}
