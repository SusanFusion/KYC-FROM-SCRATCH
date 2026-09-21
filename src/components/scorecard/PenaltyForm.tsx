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
      {/* Row 1: agent, infraction, then Count pushed out to its own wider
          slot on the right -- it used to sit squeezed between infraction and
          date (1 of 6 columns), which is why it was so easy to miss at
          normal zoom. Giving it col-span-2 here, the same width as every
          other field, is the actual fix for that -- not just cosmetic. */}
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
      {/* type="text" (not "number") deliberately -- see addPenaltyAction,
          which already coerces whatever's typed here to a number and falls
          back to 1 for anything invalid or blank, so this doesn't need the
          browser's native number-input widget to behave correctly. */}
      <Input
        name="count"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        defaultValue={1}
        placeholder="Count"
        className="lg:col-span-2"
      />
      {/* Row 2: date sits directly under Agent (same lg:col-span-2 slot),
          note fills the rest of the row. */}
      <Input name="occurredOn" type="date" defaultValue={getLocalTodayIso()} className="lg:col-span-2" />
      <Input name="note" placeholder="Note (optional)" className="lg:col-span-4" />
      {/* Row 3: submit, on its own row now that row 2 is full (date + note
          already add up to all 6 columns). */}
      <div className="flex items-center gap-2 lg:col-span-6 lg:justify-end">
        <SubmitButton />
        {status === "success" && <span className="text-xs text-success">Recorded.</span>}
      </div>
    </form>
  );
}
