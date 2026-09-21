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
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6"
    >
      <input type="hidden" name="periodId" value={periodId} />
      <Select name="agentId" required defaultValue="" className="lg:col-span-2">
        <option value="" disabled>
          Select agent…
        </option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      <Select name="code" required defaultValue="" className="lg:col-span-2">
        <option value="" disabled>
          Select infraction…
        </option>
        {ALL_PENALTIES.map((p) => (
          <option key={p.code} value={p.code}>
            {p.label} (-{p.deduction.toFixed(2)})
          </option>
        ))}
      </Select>
      {/* Chrome/Safari/Edge draw a native up/down spinner control inside
          type="number" fields, visually divided from the text area by its
          own thin border -- on a field this narrow that reads as a second,
          overlapping box rather than a spinner. (Extra right padding alone,
          tried first, didn't remove that divider -- it's the browser's own
          spin-button chrome, not a spacing issue.) Turning the spin buttons
          off removes that seam entirely, leaving one clean box; the field
          still only accepts numbers via type="number" and min=1. */}
      <Input
        name="count"
        type="number"
        min={1}
        defaultValue={1}
        placeholder="Count"
        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <Input name="occurredOn" type="date" defaultValue={getLocalTodayIso()} />
      <Input name="note" placeholder="Note (optional)" className="lg:col-span-4" />
      <div className="flex items-center gap-2 lg:col-span-2">
        <SubmitButton />
        {status === "success" && <span className="text-xs text-success">Recorded.</span>}
      </div>
    </form>
  );
}
