"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { deletePenaltyAction } from "@/app/penalties/actions";

function ConfirmSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (
          !window.confirm(
            "Delete this penalty entry? This immediately updates the agent's individual score and the Rankings board."
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

/** One "Delete" action on a single recorded penalty row (Penalties page).
 *  Deleting the underlying record is enough on its own — every score,
 *  Scorecard breakdown, and Rankings position is always derived fresh from
 *  raw data (see src/lib/data/query.ts), never cached or persisted, so
 *  nothing else needs to be recalculated or backfilled. */
export function DeletePenaltyButton({ id, agentId }: { id: string; agentId: string }) {
  return (
    <form
      action={async (formData: FormData) => {
        await deletePenaltyAction(formData);
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="agentId" value={agentId} />
      <ConfirmSubmitButton />
    </form>
  );
}
