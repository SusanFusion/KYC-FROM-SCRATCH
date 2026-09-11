"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/data/repository";
import type { PenaltyCode } from "@/lib/scoring/types";

export async function addPenaltyAction(formData: FormData) {
  const agentId = String(formData.get("agentId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const code = String(formData.get("code") ?? "") as PenaltyCode;
  const count = Number(formData.get("count") ?? 1) || 1;
  const note = String(formData.get("note") ?? "");
  const occurredOn = String(formData.get("occurredOn") ?? new Date().toISOString().slice(0, 10));

  if (!agentId || !periodId || !code) return { ok: false, error: "Missing required fields." };

  const repo = await getRepository();
  await repo.addPenalty({ agentId, periodId, code, count, note: note || undefined, occurredOn });

  revalidatePath("/penalties");
  revalidatePath("/rankings");
  revalidatePath(`/scorecards/${agentId}`);
  return { ok: true };
}
