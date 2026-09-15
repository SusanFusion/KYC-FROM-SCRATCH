import { getRepository } from "./repository";
import {
  calculateFullAgentResult,
  calculateIndividualScore,
  calculateBusinessGate,
  INDIVIDUAL_METRICS,
  GATE_METRICS,
  type FullAgentPeriodResult,
} from "@/lib/scoring";
import { startOfWeek, weekRange, monthRange, monthKey, formatWeekLabel, formatMonthLabel, formatDayLabel } from "./dateRanges";
import type { Agent, Period, PeriodType, Team } from "@/types/domain";
import type { IndividualMetricKey, PenaltyEntry, RawAgentMetrics, RawGateMetrics } from "@/lib/scoring/types";

/** A stand-in for an agent with no imported row for this period at all —
 *  every field "No data" rather than the agent being silently left off
 *  Rankings/Scorecards. The scoring engine already treats an all-null raw
 *  record safely: every metric excludes itself, hasIncompleteData is set,
 *  and the final score renormalizes to 0 rather than crashing or dividing
 *  by zero (see individualScore.ts). */
function emptyRawMetrics(agentId: string, periodId: string): RawAgentMetrics {
  return {
    agentId,
    periodId,
    totalChatConversations: null,
    avgFirstResponseTimeSec: null,
    avgResponseTimeSec: null,
    emailAHTSec: null,
    appAHTSec: null,
    totalChats: null,
    csatCount: null,
    dsatCount: null,
    qaAuditPct: null,
  };
}

export interface AgentPeriodResult extends FullAgentPeriodResult {
  agent: Agent;
}

export interface PeriodDataset {
  period: Period | null;
  periods: Period[];
  teams: Team[];
  agents: Agent[];
  gate: RawGateMetrics | null;
  results: AgentPeriodResult[];
  /** Results sorted by final score, descending — index 0 is the Top 1 agent for this period. */
  ranked: AgentPeriodResult[];
  tieForTop: boolean;
}

/**
 * The shared scoring pass used by every dataset loader below, whether the
 * raw metrics came from a single imported period (loadPeriodDataset) or
 * were aggregated across several daily periods (loadRangeDataset) — kept in
 * one place so a single-day view and a weekly/MTD view can never silently
 * diverge on how a score, tie, or "no data" placeholder is derived.
 */
function computeResults(
  agents: Agent[],
  rawMetrics: RawAgentMetrics[],
  gateInput: RawGateMetrics,
  penalties: PenaltyEntry[]
): { results: AgentPeriodResult[]; ranked: AgentPeriodResult[]; tieForTop: boolean } {
  // Every agent on the roster gets a row — even one with no import for this
  // period at all. Previously this started from the imported rows and
  // looked up the agent, so an agent nobody had gotten around to importing
  // yet simply never appeared anywhere (Rankings, Scorecards) with no
  // indication they existed. Starting from the full roster instead means
  // they still show up, just with every metric reading "No data" (and the
  // existing "Incomplete" badge, same as any other partial-data agent).
  const prelim = agents.map((agent) => {
    const raw = rawMetrics.find((r) => r.agentId === agent.id) ?? emptyRawMetrics(agent.id, gateInput.periodId);
    return { raw, agent };
  });

  const scored = prelim.map(({ raw, agent }) => ({
    agent,
    raw,
    finalScore: calculateFullAgentResult({
      rawMetrics: raw,
      rawGate: gateInput,
      penalties,
      isTopPerformer: false,
      tenureEligible: agent.tenureEligible,
    }).individual.finalScore,
  }));

  const maxScore = scored.reduce((max, s) => Math.max(max, s.finalScore), -Infinity);
  const topScorers = scored.filter((s) => s.finalScore === maxScore);
  const tieForTop = topScorers.length > 1;
  const topAgentIds = new Set(topScorers.map((s) => s.agent.id));

  const results: AgentPeriodResult[] = scored.map(({ agent, raw }) =>
    ({
      agent,
      ...calculateFullAgentResult({
        rawMetrics: raw,
        rawGate: gateInput,
        penalties,
        isTopPerformer: topAgentIds.has(agent.id) && !tieForTop,
        tenureEligible: agent.tenureEligible,
      }),
    })
  );

  const ranked = [...results].sort((a, b) => b.individual.finalScore - a.individual.finalScore);
  return { results, ranked, tieForTop };
}

/**
 * The single place page code should call to get a fully-computed dataset
 * for a period: raw data comes from the repository, every score/tier/bonus
 * is derived fresh via the scoring engine (never read pre-calculated from
 * storage — see repository.ts).
 */
export async function loadPeriodDataset(periodId?: string): Promise<PeriodDataset> {
  const repo = await getRepository();
  const [periods, teams, agents] = await Promise.all([repo.getPeriods(), repo.getTeams(), repo.getAgents()]);

  const period = periodId ? periods.find((p) => p.id === periodId) ?? null : periods[0] ?? null;
  if (!period) {
    return { period: null, periods, teams, agents, gate: null, results: [], ranked: [], tieForTop: false };
  }

  const [rawMetrics, gate, penalties] = await Promise.all([
    repo.getRawMetrics(period.id),
    repo.getGateMetrics(period.id),
    repo.getPenalties(period.id),
  ]);

  const gateInput: RawGateMetrics =
    gate ?? {
      periodId: period.id,
      clientAvgWaitTimeMin: null,
      teamProcessingTimeMin: null,
      chatTeamAvgResponseSec: null,
      teamTicketAHTMin: null,
    };

  const { results, ranked, tieForTop } = computeResults(agents, rawMetrics, gateInput, penalties);

  return { period, periods, teams, agents, gate: gateInput, results, ranked, tieForTop };
}

export async function loadAgentPeriodResult(agentId: string, periodId?: string): Promise<{
  dataset: PeriodDataset;
  result: AgentPeriodResult | null;
  rank: number | null;
}> {
  const dataset = await loadPeriodDataset(periodId);
  const idx = dataset.ranked.findIndex((r) => r.agent.id === agentId);
  return { dataset, result: idx >= 0 ? dataset.ranked[idx]! : null, rank: idx >= 0 ? idx + 1 : null };
}

// ─────────────────────────────────────────────────────────────────────────
// Weekly / month-to-date aggregation
//
// A "daily period" is any imported period whose start and end date are the
// same day — every day Susan imports going forward (see commitImportRows.ts,
// which now labels a same-day import "daily" rather than "custom"). A week
// or MTD view is built by gathering every daily period that falls inside
// the target date range and aggregating each agent's raw numbers across
// those days, THEN running that aggregate through the exact same
// computeResults() scoring pass a single day uses — so a week/month view
// can never compute a score by different rules than a single day does.
//
// The two kinds of raw fields aggregate differently:
//   - AHT / response-time / QA Audit % are plain averages with no paired
//     "count of things averaged" field in the data (see notes.ts and the
//     Trends delta-precision fix) — the only honest way to combine several
//     days of them is an unweighted mean across the days that have data.
//   - Total chats/conversations and CSAT/DSAT counts are true counts, so
//     they SUM across days; CSAT/DSAT % is then re-derived from those
//     summed counts (never averaged as a percentage), which is exact.
// A day with no data for a given agent/field is skipped entirely rather
// than treated as a zero, matching the app's existing "don't penalize for
// missing data" stance (see notes.ts "missing-qa-audit-data").
// ─────────────────────────────────────────────────────────────────────────

const AVERAGE_FIELDS = ["avgFirstResponseTimeSec", "avgResponseTimeSec", "emailAHTSec", "appAHTSec", "qaAuditPct"] as const;
const SUM_FIELDS = ["totalChatConversations", "totalChats", "csatCount", "dsatCount"] as const;
const GATE_FIELDS = ["clientAvgWaitTimeMin", "teamProcessingTimeMin", "chatTeamAvgResponseSec", "teamTicketAHTMin"] as const;

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

function sum(values: number[]): number | null {
  return values.length ? values.reduce((s, v) => s + v, 0) : null;
}

function aggregateAgentRaw(agentId: string, periodId: string, dayRows: RawAgentMetrics[]): RawAgentMetrics {
  if (dayRows.length === 0) return emptyRawMetrics(agentId, periodId);
  const result = emptyRawMetrics(agentId, periodId);
  for (const field of AVERAGE_FIELDS) {
    result[field] = mean(dayRows.map((r) => r[field]).filter((v): v is number => v !== null));
  }
  for (const field of SUM_FIELDS) {
    result[field] = sum(dayRows.map((r) => r[field]).filter((v): v is number => v !== null));
  }
  return result;
}

function aggregateGate(dayGates: (RawGateMetrics | null)[], periodId: string): RawGateMetrics {
  const result: RawGateMetrics = {
    periodId,
    clientAvgWaitTimeMin: null,
    teamProcessingTimeMin: null,
    chatTeamAvgResponseSec: null,
    teamTicketAHTMin: null,
  };
  for (const field of GATE_FIELDS) {
    result[field] = mean(dayGates.map((g) => g?.[field] ?? null).filter((v): v is number => v !== null));
  }
  return result;
}

/** Every imported period whose start and end date are the same day. */
export function getDailyPeriods(allPeriods: Period[]): Period[] {
  return allPeriods.filter((p) => p.startDate === p.endDate).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
}

export interface RangeSpec {
  start: string; // YYYY-MM-DD, inclusive
  end: string; // YYYY-MM-DD, inclusive
  label: string;
  id: string;
  type: PeriodType;
}

/**
 * Aggregates every daily period inside [spec.start, spec.end] into one
 * dataset, shaped exactly like loadPeriodDataset's — same result type, same
 * scoring pass — so any page that already knows how to render a
 * PeriodDataset (Team Performance, Trends, Rankings) needs no special
 * casing to render a weekly or MTD one instead of a single day's.
 */
export async function loadRangeDataset(spec: RangeSpec): Promise<PeriodDataset> {
  const repo = await getRepository();
  const [allPeriods, teams, agents] = await Promise.all([repo.getPeriods(), repo.getTeams(), repo.getAgents()]);
  const dayPeriods = getDailyPeriods(allPeriods).filter((p) => p.startDate >= spec.start && p.endDate <= spec.end);

  const period: Period = { id: spec.id, label: spec.label, type: spec.type, startDate: spec.start, endDate: spec.end, generatedAt: spec.end };

  const [perDayRaw, perDayGate, allPenalties] = await Promise.all([
    Promise.all(dayPeriods.map((p) => repo.getRawMetrics(p.id))),
    Promise.all(dayPeriods.map((p) => repo.getGateMetrics(p.id))),
    repo.getPenalties(),
  ]);

  const rawMetrics = agents.map((agent) => {
    const rows = perDayRaw.flatMap((dayRows) => dayRows.filter((r) => r.agentId === agent.id));
    return aggregateAgentRaw(agent.id, spec.id, rows);
  });

  const gateInput = aggregateGate(perDayGate, spec.id);

  // Penalties carry their own occurredOn date (independent of which period
  // they were logged against), so a range view collects every penalty whose
  // date falls in the window and re-tags it with this range's synthetic
  // period id — calculatePenalty() matches strictly on periodId, so without
  // this remap a week/month's penalties (logged against their own daily
  // period ids) would silently fail to apply at all.
  const penalties = allPenalties
    .filter((p) => p.occurredOn >= spec.start && p.occurredOn <= spec.end)
    .map((p) => ({ ...p, periodId: spec.id }));

  const { results, ranked, tieForTop } = computeResults(agents, rawMetrics, gateInput, penalties);

  return { period, periods: allPeriods, teams, agents, gate: gateInput, results, ranked, tieForTop };
}

export interface WeekOption {
  /** Sunday, YYYY-MM-DD — the value used for the week's ?week= param and as loadRangeDataset's start. */
  start: string;
  end: string;
  label: string;
}

/** Every Sunday–Saturday week that contains at least one daily import, most recent first. */
export async function listAvailableWeeks(): Promise<WeekOption[]> {
  const repo = await getRepository();
  const dayPeriods = getDailyPeriods(await repo.getPeriods());
  const starts = new Set(dayPeriods.map((p) => startOfWeek(p.startDate)));
  return [...starts]
    .sort((a, b) => (a < b ? 1 : -1))
    .map((start) => {
      const range = weekRange(start);
      return { start: range.start, end: range.end, label: formatWeekLabel(range) };
    });
}

export interface MonthOption {
  /** "YYYY-MM" — the value used for the month's ?month= param. */
  key: string;
  start: string;
  /** The latest daily import actually on record this month (not necessarily the calendar month's last day). */
  end: string;
  label: string;
}

/** Every calendar month that contains at least one daily import, most recent first — "end" is the latest day actually imported, so an in-progress month reads as MTD-through-that-day rather than projecting the rest of the month. */
export async function listAvailableMonths(): Promise<MonthOption[]> {
  const repo = await getRepository();
  const dayPeriods = getDailyPeriods(await repo.getPeriods());
  const latestByMonth = new Map<string, string>();
  for (const p of dayPeriods) {
    const key = monthKey(p.startDate);
    const prev = latestByMonth.get(key);
    if (!prev || p.startDate > prev) latestByMonth.set(key, p.startDate);
  }
  return [...latestByMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, latestDay]) => ({ key, start: monthRange(latestDay).start, end: latestDay, label: formatMonthLabel(latestDay) }));
}

// ─────────────────────────────────────────────────────────────────────────
// Per-officer daily KPI trends (Trends page "Individual KPI Trends")
//
// Unlike the weekly views above, this deliberately does NOT aggregate: the
// whole point is to see day-to-day movement, so each daily period's raw
// value is graded on its own via the same calculateIndividualScore() every
// other page uses (no separate formula) and plotted as one point. A day
// where this agent has no row at all is a genuine gap (null), never
// treated as zero or silently dropped — the chart just skips drawing a
// line segment across it, matching the app's "don't fabricate missing
// data" stance used everywhere else.
// ─────────────────────────────────────────────────────────────────────────

export interface DailyMetricPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Sep 14"
  actual: number | null;
  actualDisplay: string;
}

export interface DailyIndividualMetricSeries {
  key: IndividualMetricKey;
  name: string;
  unit: "minutes" | "seconds" | "percent";
  points: DailyMetricPoint[];
}

/**
 * One line series per individual KPI (appAHT, emailAHT, chatAvgResponse,
 * chatFRT, csatDsat, qaAudit) for a single agent, across their most recent
 * `days` daily periods (oldest → newest) — or every daily period on record
 * when `days` is null ("all time").
 */
export async function loadAgentDailyTrend(agentId: string, days: number | null): Promise<DailyIndividualMetricSeries[]> {
  const repo = await getRepository();
  const allDays = getDailyPeriods(await repo.getPeriods()); // already ascending by startDate
  const dayPeriods = days !== null ? allDays.slice(-days) : allDays;

  const rawByDay = await Promise.all(dayPeriods.map((p) => repo.getRawMetrics(p.id)));

  const series: DailyIndividualMetricSeries[] = INDIVIDUAL_METRICS.map((def) => ({
    key: def.key,
    name: def.name,
    unit: def.unit,
    points: [],
  }));

  dayPeriods.forEach((period, i) => {
    const raw = rawByDay[i]!.find((r) => r.agentId === agentId) ?? null;
    // Penalties never affect a metric's own "actual" value (only the final
    // score), so an empty penalty list here is safe — this is purely about
    // reading each day's raw number through the same grading/formatting
    // logic every other page uses, not recomputing a score.
    const scored = raw ? calculateIndividualScore(raw, []) : null;
    const label = formatDayLabel(period.startDate);
    for (const s of series) {
      const m = scored?.metrics.find((mm) => mm.key === s.key);
      s.points.push({
        date: period.startDate,
        label,
        actual: m?.actual ?? null,
        actualDisplay: m?.actualDisplay ?? "No data",
      });
    }
  });

  return series;
}

// ─────────────────────────────────────────────────────────────────────────
// Business Gate multiplier trend (Trends page "Business Gate Multiplier"
// card — the daily companion line)
//
// The card's headline number and its weekly chart are read straight off the
// same per-week BusinessGateResult already computed for every week's
// dataset (see loadRangeDataset/computeResults) — the gate multiplier is
// team-wide, not per-agent, so every agent's `.gate` for a period is
// identical and trends/page.tsx just reads results[0].gate. This is the
// genuinely-daily companion: one point per calendar day, no aggregation.
// ─────────────────────────────────────────────────────────────────────────

/** calculateBusinessGate() defaults an all-null RawGateMetrics to a neutral
 *  1.0000× multiplier (see businessGate.ts's effectiveWeight === 0
 *  fallback) — reading that as "the team scored exactly average" would be
 *  a fabrication when really no Business Gate numbers were ever imported
 *  for that period. Only treat the multiplier as real once at least one of
 *  the four Business Gate metrics actually has a value. */
export function gateMultiplierOrNull(gate: ReturnType<typeof calculateBusinessGate>): number | null {
  return gate.metrics.some((m) => m.actual !== null) ? gate.gateMultiplier : null;
}

export interface DailyGateMultiplierPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Sep 14"
  /** Null = no Business Gate metrics at all that day — a genuine gap,
   *  never the multiplier's own neutral-default value. */
  multiplier: number | null;
}

/**
 * One point per calendar day (oldest → newest) across the most recent
 * `days` daily periods on record — or every daily period when `days` is
 * null ("all time") — each the Business Gate multiplier for that day
 * alone, computed through the exact same calculateBusinessGate() pass
 * every other Business Gate number in the app uses.
 */
export async function loadGateDailyTrend(days: number | null): Promise<DailyGateMultiplierPoint[]> {
  const repo = await getRepository();
  const allDays = getDailyPeriods(await repo.getPeriods()); // already ascending by startDate
  const dayPeriods = days !== null ? allDays.slice(-days) : allDays;

  const gateByDay = await Promise.all(dayPeriods.map((p) => repo.getGateMetrics(p.id)));

  return dayPeriods.map((period, i) => {
    const raw = gateByDay[i];
    const multiplier = raw ? gateMultiplierOrNull(calculateBusinessGate(raw)) : null;
    return {
      date: period.startDate,
      label: formatDayLabel(period.startDate),
      multiplier,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Business Gate metric trends (Trends page "Business Gate Trends" card) —
// the daily companion to gateWeeklySeries, same relationship
// loadGateDailyTrend has to the weekly multiplier chart above it.
//
// gateWeeklySeries aggregates every daily import inside each week into ONE
// point (so several days imported in the same Sun–Sat week collapse to a
// single point on that chart, by design — see loadRangeDataset/
// aggregateGate). This is the un-aggregated view: one point per calendar
// day, so newly-imported days show up as new points immediately rather
// than only moving the existing week's average. A day with no report for a
// given metric is a real gap (null), never a fabricated value — same rule
// as every other trend line on this page.
// ─────────────────────────────────────────────────────────────────────────

export interface DailyGateMetricPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Sep 14"
  actual: number | null;
  actualDisplay: string;
}

export interface DailyGateMetricSeries {
  key: string;
  name: string;
  unit: "minutes" | "seconds";
  points: DailyGateMetricPoint[];
}

/**
 * One line series per Business Gate metric (clientAvgWaitTime,
 * teamProcessingTime, chatTeamAvgResponse, teamTicketAHT), across the most
 * recent `days` daily periods on record — or every daily period when `days`
 * is null ("all time") — each day's value read through the exact same
 * calculateBusinessGate() pass every other Business Gate number in the app
 * uses (no separate formula).
 */
export async function loadGateMetricsDailyTrend(days: number | null): Promise<DailyGateMetricSeries[]> {
  const repo = await getRepository();
  const allDays = getDailyPeriods(await repo.getPeriods()); // already ascending by startDate
  const dayPeriods = days !== null ? allDays.slice(-days) : allDays;

  const gateByDay = await Promise.all(dayPeriods.map((p) => repo.getGateMetrics(p.id)));
  const gateResultByDay = gateByDay.map((raw) => (raw ? calculateBusinessGate(raw) : null));

  return GATE_METRICS.map((def) => ({
    key: def.key,
    name: def.name,
    unit: def.unit,
    points: dayPeriods.map((period, i): DailyGateMetricPoint => {
      const m = gateResultByDay[i]?.metrics.find((mm) => mm.key === def.key);
      return {
        date: period.startDate,
        label: formatDayLabel(period.startDate),
        actual: m?.actual ?? null,
        actualDisplay: m?.actualDisplay ?? "No data",
      };
    }),
  }));
}
