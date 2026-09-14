import { getRepository } from "./repository";
import { calculateFullAgentResult, type FullAgentPeriodResult } from "@/lib/scoring";
import type { Agent, Period, Team } from "@/types/domain";
import type { RawAgentMetrics, RawGateMetrics } from "@/lib/scoring/types";

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

  // Every agent on the roster gets a row — even one with no import for this
  // period at all. Previously this started from the imported rows and
  // looked up the agent, so an agent nobody had gotten around to importing
  // yet simply never appeared anywhere (Rankings, Scorecards) with no
  // indication they existed. Starting from the full roster instead means
  // they still show up, just with every metric reading "No data" (and the
  // existing "Incomplete" badge, same as any other partial-data agent).
  const prelim = agents.map((agent) => {
    const raw = rawMetrics.find((r) => r.agentId === agent.id) ?? emptyRawMetrics(agent.id, period.id);
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
