import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data/repository";
import { requireActionAccess } from "@/lib/auth/actionAccess";
import { APP_NAME } from "@/lib/appConfig";

export const dynamic = "force-dynamic";

/**
 * One-click full DATA backup — every raw table this app stores in Supabase
 * (teams, agents, periods, raw per-agent metrics, Business Gate metrics,
 * penalties, QA audits, import history), bundled as a single downloadable
 * JSON file. This is deliberately the data half only: the CODE half of
 * "back up my progress" is already fully versioned by every commit on
 * GitHub, so there's nothing for this route to do there.
 *
 * Scores, gate multipliers, grades and bonuses are NOT included — per
 * repository.ts's own architecture note, this app only ever stores RAW
 * inputs and always derives every score fresh on read (see
 * src/lib/scoring). Backing up the raw rows below is both smaller and more
 * correct than freezing a point-in-time score, since re-importing this
 * file's rows through a restore path would recompute identical results
 * (or updated ones, if a scoring rule has changed since).
 *
 * Same password gate as the report exports (requireActionAccess) — this is
 * the single richest export of the team's raw data in the app.
 */
export async function GET() {
  const denied = await requireActionAccess();
  if (denied) return denied;

  const repo = await getRepository();
  const [teams, agents, periods, rawMetrics, gateMetrics, penalties, qaAudits, imports] = await Promise.all([
    repo.getTeams(),
    repo.getAgents(),
    repo.getPeriods(),
    repo.getRawMetrics(),
    repo.getAllGateMetrics(),
    repo.getPenalties(),
    repo.getQaAudits(),
    repo.getImports(),
  ]);

  const backup = {
    app: APP_NAME,
    exportedAt: new Date().toISOString(),
    // Bump this if the shape of this JSON ever changes, so a future restore
    // tool (or a human reading an old backup) can tell what it's looking at.
    schemaVersion: 1,
    counts: {
      teams: teams.length,
      agents: agents.length,
      periods: periods.length,
      rawMetrics: rawMetrics.length,
      gateMetrics: gateMetrics.length,
      penalties: penalties.length,
      qaAudits: qaAudits.length,
      imports: imports.length,
    },
    teams,
    agents,
    periods,
    rawMetrics,
    gateMetrics,
    penalties,
    qaAudits,
    imports,
  };

  const json = JSON.stringify(backup, null, 2);
  const filename = `kyc-data-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
