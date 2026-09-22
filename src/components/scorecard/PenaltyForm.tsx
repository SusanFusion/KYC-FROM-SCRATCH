// src/components/scorecard/PenaltyForm.tsx
"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ALL_PENALTIES } from "@/lib/scoring";
import { addPenaltyAction } from "@/app/penalties/actions";
import { getLocalTodayIso } from "@/lib/utils";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Recording…" : "Record penalty"}
    </Button>
  );
}

// Small shared label, matching the style ManualEntryForm already uses
// elsewhere in the app -- every field here is now clearly identified
// instead of relying on placeholder text alone (placeholder text vanishes
// the moment you start typing, which was part of why "Count" wasn't
// obvious what it was for).
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-muted-foreground">{children}</label>;
}

export function PenaltyForm({
  agents,
  periodId,
}: {
  agents: { id: string; name: string }[];
  periodId: string;
}) {
  const [status, setStatus] = React.useState<"idle" | "success">("idle");
  const formRef = React.useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        const result = await addPenaltyAction(formData);
        if (result.ok) {
          setStatus("success");
          formRef.current?.reset();
          setTimeout(() => setStatus("idle"), 2500);
        }
      }}
      // More breathing room than before: gap-x-4 (16px) between columns,
      // gap-y-5 (20px) between rows -- rows now read as visually distinct
      // groups instead of everything crowding together.
      className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-6"
    >
      <input type="hidden" name="periodId" value={periodId} />

      {/* Row 1: agent, infraction, count -- each an equal-width slot. Count
          used to be squeezed into 1 of 6 columns; giving it the same
          col-span-2 as everything else is what actually fixed it being
          hard to see, not just the spacing around it. */}
      <div className="lg:col-span-2">
        <FieldLabel>Agent</FieldLabel>
        <Select name="agentId" required defaultValue="">
          <option value="" disabled>
            Select agent…
          </option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="lg:col-span-2">
        <FieldLabel>Infraction</FieldLabel>
        <Select name="code" required defaultValue="">
          <option value="" disabled>
            Select infraction…
          </option>
          {ALL_PENALTIES.map((p) => (
            <option key={p.code} value={p.code}>
              {/* Employment track-record actions (status set, deduction
                  always 0) show their status instead of "(-0.00)", which
                  would misleadingly read as a real, if tiny, deduction. */}
              {p.label} {p.status ? `(${p.status.label})` : `(-${p.deduction.toFixed(2)})`}
            </option>
          ))}
        </Select>
      </div>

      <div className="lg:col-span-2">
        <FieldLabel>Count</FieldLabel>
        {/* type="text" (not "number") deliberately -- addPenaltyAction
            already coerces whatever's typed here to a number and falls back
            to 1 for anything invalid or blank, so this doesn't need the
            browser's native number-input widget to behave correctly. */}
        <Input name="count" type="text" inputMode="numeric" pattern="[0-9]*" defaultValue={1} placeholder="1" />
      </div>

      {/* Row 2: date and who's recording this, each half the row. */}
      <div className="lg:col-span-3">
        <FieldLabel>Date</FieldLabel>
        <Input name="occurredOn" type="date" defaultValue={getLocalTodayIso()} />
      </div>

      <div className="lg:col-span-3">
        <FieldLabel>Recorded by</FieldLabel>
        <Input name="recordedBy" required placeholder="Your name" autoComplete="name" />
      </div>

      {/* Row 3: note, full width. */}
      <div className="lg:col-span-6">
        <FieldLabel>Note (optional)</FieldLabel>
        <Input name="note" placeholder="Add any context…" />
      </div>

      {/* Row 4: submit, on its own row, right-aligned, with a little extra
          top padding so it doesn't feel glued to the row above. */}
      <div className="flex items-center gap-2 lg:col-span-6 lg:justify-end lg:pt-1">
        <SubmitButton />
        {status === "success" && <span className="text-xs text-success">Recorded.</span>}
      </div>
    </form>
  );
}
