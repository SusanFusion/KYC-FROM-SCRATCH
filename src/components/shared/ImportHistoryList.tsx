"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";

export interface ImportHistoryRow {
  id: string;
  fileName: string;
  uploadedAt: string;
  periodLabel: string | null;
  status: "pending_review" | "committed" | "failed";
  rowCount: number;
  periodId: string | null;
}

export function ImportHistoryList({ imports }: { imports: ImportHistoryRow[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = React.useState<ImportHistoryRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/import/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId: pending.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail ? `${data.error} (${data.detail})` : data.error ?? "Failed to delete.", "error");
        return;
      }
      showToast(
        data.deletedPeriod
          ? `Deleted "${data.periodLabel}" — removed from every page that reads it.`
          : data.message ?? "Import record removed.",
        "success"
      );
      setPending(null);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unexpected error.", "error");
    } finally {
      setDeleting(false);
    }
  }

  if (imports.length === 0) {
    return <p className="text-sm text-muted-foreground">No imports yet.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {imports.map((imp) => (
          <li key={imp.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{imp.fileName}</p>
              <p className="text-xs text-muted-foreground">
                Uploaded {formatDate(imp.uploadedAt)} · {imp.rowCount} rows
                {imp.periodLabel ? ` · ${imp.periodLabel}` : ""}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <Badge variant={imp.status === "committed" ? "success" : imp.status === "failed" ? "danger" : "outline"}>
                {imp.status.replace("_", " ")}
              </Badge>
              <button
                type="button"
                onClick={() => setPending(imp)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                aria-label={`Delete ${imp.fileName}`}
                title="Delete this import"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && !deleting && setPending(null)}
        title="Delete this import?"
        description={
          pending?.periodId
            ? `This will remove "${pending.periodLabel ?? "this period"}" and everything recorded for it — individual metrics, Business Gate numbers, and any penalties logged against it. It will no longer appear on Team Performance, Trends, Overall MTD, Dashboard, Rankings, Scorecards, or Reports. This can't be undone.`
            : "This removes the import record from the history above. It never affected any period's data (it wasn't committed, or was committed before this link was tracked), so nothing else on the app changes."
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setPending(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </>
        }
      />
    </>
  );
}
