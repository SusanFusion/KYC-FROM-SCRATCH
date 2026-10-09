// The Raw Data page's write logic -- edit one agent's KPI values for one day,
// or delete that agent's entry for the day -- kept in its own module (taking
// the repository as a parameter) so it can be tested without Next.js, and so
// app/raw-data/actions.ts stays a thin "check the password, call this,
// refresh the pages" wrapper.
//
// Two rules shape everything here:
//  1. A change is NEVER saved without its reason and who made it: if the
//     history entry can't be written, the data change is rolled back.
//  2. What the page shows is what every score is built from. Each import
//     mints its own daily period, so one agent's day can be spread over
//     several periods, with the most recent value per field winning (see
//     mergeRawValues). An edit therefore writes the new value into EVERY
//     period of that day that holds a row for the agent -- otherwise an older
//     period's value could quietly win again, or resurface after a blank.
import type { DataRepository } from "./repository";
import type { Period } from "@/types/domain";
import type { RawAgentMetrics, RawGateMetrics } from "@/lib/scoring/types";
import { getDailyPeriods } from "./query";
import { addRawDataChange } from "./rawDataChangeLog";
import {
  RAW_FIELDS,
  mergeRawValues,
  rawValuesEqual,
  type RawDataChange,
  type RawDataFieldChange,
  type RawValues,
} from "./rawDataFields";

/** commitImport() wants an import id to mark "committed"; an edit isn't an
 *  import, so this nil id matches no import record and that step is a no-op
 *  (it also keeps Import History free of "Manual edit" clutter). */
const NO_IMPORT_ID = "00000000-0000-0000-0000-000000000000";

export const MIN_REASON_LENGTH = 5;

export type RawEditResult = { ok: true; change: RawDataChange } | { ok: false; error: string };

interface Target {
  period: Period;
  /** Every agent's row in this period, exactly as stored (needed to rewrite the period). */
  rows: RawAgentMetrics[];
  gate: RawGateMetrics;
  /** This agent's row in the period. */
  agentRow: RawAgentMetrics;
}

function blankGate(periodId: string): RawGateMetrics {
  return { periodId, clientAvgWaitTimeMin: null, teamProcessingTimeMin: null, chatTeamAvgResponseSec: null, teamTicketAHTMin: null };
}

/** Every period of `date` that has a row for this agent, oldest import first. */
async function loadTargets(repo: DataRepository, agentId: string, date: string): Promise<Target[]> {
  const [periods, imports] = await Promise.all([repo.getPeriods(), repo.getImports()]);
  const stampByPeriod = new Map<string, string>();
  for (const imp of imports) {
    if (!imp.periodId) continue;
    const stamp = imp.committedAt ?? imp.uploadedAt;
    const prev = stampByPeriod.get(imp.periodId);
    if (!prev || stamp > prev) stampByPeriod.set(imp.periodId, stamp);
  }

  const dayPeriods = getDailyPeriods(periods)
    .filter((p) => p.startDate === date)
    .sort((a, b) => {
      const sa = stampByPeriod.get(a.id) ?? "";
      const sb = stampByPeriod.get(b.id) ?? "";
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });

  const targets: Target[] = [];
  for (const period of dayPeriods) {
    const [rows, gate] = await Promise.all([repo.getRawMetrics(period.id), repo.getGateMetrics(period.id)]);
    const agentRow = rows.find((r) => r.agentId === agentId);
    if (agentRow) targets.push({ period, rows, gate: gate ?? blankGate(period.id), agentRow });
  }
  return targets;
}

async function restore(repo: DataRepository, targets: Target[]): Promise<void> {
  for (const t of targets) {
    await repo.commitImport(NO_IMPORT_ID, t.period, t.rows, t.gate);
  }
}

function validateReason(reason: string, changedBy: string): string | null {
  if (reason.trim().length < MIN_REASON_LENGTH) {
    return `Please give a reason (at least ${MIN_REASON_LENGTH} characters) — every edit and deletion has to be explained.`;
  }
  if (!changedBy.trim()) return "Pick who is making this change.";
  return null;
}

export interface RawEditArgs {
  agentId: string;
  date: string;
  /** The new value for every field (null = no data). Untouched fields should simply be passed back unchanged. */
  values: Partial<Record<string, number | null>>;
  reason: string;
  changedBy: string;
}

export async function applyRawEntryEdit(repo: DataRepository, args: RawEditArgs): Promise<RawEditResult> {
  const reasonError = validateReason(args.reason, args.changedBy);
  if (reasonError) return { ok: false, error: reasonError };

  // Validate each submitted number against its field's unit.
  const next: Partial<RawValues> = {};
  for (const f of RAW_FIELDS) {
    if (!(f.key in args.values)) continue;
    const v = args.values[f.key];
    if (v === undefined) continue;
    if (v !== null) {
      if (!Number.isFinite(v) || v < 0) return { ok: false, error: `${f.label}: enter a number that is 0 or more (or leave it blank for no data).` };
      if (f.kind === "count" && !Number.isInteger(v)) return { ok: false, error: `${f.label}: must be a whole number.` };
      if (f.kind === "percent" && v > 100) return { ok: false, error: `${f.label}: can't be more than 100.` };
    }
    next[f.key] = v;
  }

  const agents = await repo.getAgents();
  const agent = agents.find((a) => a.id === args.agentId);
  if (!agent) return { ok: false, error: "That agent no longer exists." };

  const targets = await loadTargets(repo, args.agentId, args.date);
  if (targets.length === 0) return { ok: false, error: "There is no entry for that agent on that day any more — refresh the page." };

  const before = mergeRawValues(targets.map((t) => t.agentRow));
  const changes: RawDataFieldChange[] = [];
  for (const f of RAW_FIELDS) {
    if (!(f.key in next)) continue;
    const to = next[f.key] ?? null;
    if (!rawValuesEqual(before[f.key], to)) changes.push({ field: f.key, label: f.label, from: before[f.key], to });
  }
  if (changes.length === 0) return { ok: false, error: "Nothing was changed — edit at least one value before saving." };

  const applied: Target[] = [];
  try {
    for (const t of targets) {
      const nextRows = t.rows.map((r) => {
        if (r.agentId !== args.agentId) return r;
        const updated: RawAgentMetrics = { ...r };
        for (const c of changes) updated[c.field] = c.to;
        return updated;
      });
      await repo.commitImport(NO_IMPORT_ID, t.period, nextRows, t.gate);
      applied.push(t);
    }
  } catch (err) {
    await restore(repo, applied).catch(() => undefined);
    return { ok: false, error: `The change could not be saved, so nothing was changed. ${err instanceof Error ? err.message : ""}`.trim() };
  }

  try {
    const change = await addRawDataChange({
      action: "edit",
      changedBy: args.changedBy.trim(),
      reason: args.reason.trim(),
      agentId: agent.id,
      agentName: agent.name,
      date: args.date,
      changes,
    });
    return { ok: true, change };
  } catch (err) {
    await restore(repo, targets).catch(() => undefined);
    return {
      ok: false,
      error: `The change history couldn't be written, so the edit was undone. ${err instanceof Error ? err.message : ""}`.trim(),
    };
  }
}

export interface RawDeleteArgs {
  agentId: string;
  date: string;
  reason: string;
  changedBy: string;
}

export async function applyRawEntryDelete(repo: DataRepository, args: RawDeleteArgs): Promise<RawEditResult> {
  const reasonError = validateReason(args.reason, args.changedBy);
  if (reasonError) return { ok: false, error: reasonError };

  const agents = await repo.getAgents();
  const agent = agents.find((a) => a.id === args.agentId);
  if (!agent) return { ok: false, error: "That agent no longer exists." };

  const targets = await loadTargets(repo, args.agentId, args.date);
  if (targets.length === 0) return { ok: false, error: "There is no entry for that agent on that day any more — refresh the page." };

  const before = mergeRawValues(targets.map((t) => t.agentRow));
  const changes: RawDataFieldChange[] = RAW_FIELDS.filter((f) => before[f.key] !== null).map((f) => ({
    field: f.key,
    label: f.label,
    from: before[f.key],
    to: null,
  }));

  try {
    for (const t of targets) await repo.deleteRawMetric(args.agentId, t.period.id);
  } catch (err) {
    await restore(repo, targets).catch(() => undefined);
    return { ok: false, error: `The entry could not be deleted, so nothing was changed. ${err instanceof Error ? err.message : ""}`.trim() };
  }

  try {
    const change = await addRawDataChange({
      action: "delete",
      changedBy: args.changedBy.trim(),
      reason: args.reason.trim(),
      agentId: agent.id,
      agentName: agent.name,
      date: args.date,
      changes,
    });
    return { ok: true, change };
  } catch (err) {
    await restore(repo, targets).catch(() => undefined);
    return {
      ok: false,
      error: `The change history couldn't be written, so the deletion was undone. ${err instanceof Error ? err.message : ""}`.trim(),
    };
  }
}
