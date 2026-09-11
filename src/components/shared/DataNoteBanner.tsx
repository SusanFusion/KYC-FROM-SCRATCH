import { Info, AlertTriangle, HelpCircle } from "lucide-react";
import type { DataNote } from "@/lib/scoring";
import { cn } from "@/lib/utils";

const ICONS = { inconsistency: AlertTriangle, assumption: Info, gap: HelpCircle };
const STYLES = {
  inconsistency: "border-warning/30 bg-warning/5",
  assumption: "border-primary-100 bg-primary-50",
  gap: "border-border bg-muted/60",
};

export function DataNoteCard({ note }: { note: DataNote }) {
  const Icon = ICONS[note.severity];
  return (
    <div className={cn("rounded-lg border p-4", STYLES[note.severity])}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">{note.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{note.detail}</p>
        </div>
      </div>
    </div>
  );
}
