"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { deleteRawMetricAction } from "@/app/import/actions";

function ConfirmSubmitButton({ agentName, periodLabel }: { agentName: string; periodLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (
          !window.confirm(
            `Delete ${agentName}'s KPI record for ${periodLabel}? This immediately updates every score and ranking derived from it. This can't be undone.`
          )
        ) {
          e.preventDefault();
        }
      }}
      className="text-xs font-medium text-danger hover:underline disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

/** One "Delete" action on a single agent+period KPI record (Data Import
 *  page, Lead/Auditor-only -- see page.tsx's canDeleteRawMetric). Mirrors
 *  DeletePenaltyButton.tsx's lightweight single-record pattern rather than
 *  ImportHistoryList.tsx's heavier whole-day/bulk delete: deleting the
 *  underlying performance_entries row is enough on its own, since every
 *  score, Scorecard breakdown, and Rankings position is always derived
 *  fresh from raw data, never cached or persisted. */
export function DeleteRawMetricButton({
  agentId,
  periodId,
  agentName,
  periodLabel,
}: {
  agentId: string;
  periodId: string;
  agentName: string;
  periodLabel: string;
}) {
  return (
    <form
      action={async (formData: FormData) => {
        await deleteRawMetricAction(formData);
      }}
    >
      <input type="hidden" name="agentId" value={agentId} />
      <input type="hidden" name="periodId" value={periodId} />
      <ConfirmSubmitButton agentName={agentName} periodLabel={periodLabel} />
    </form>
  );
}
