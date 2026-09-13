// Builds a fully self-contained HTML report (inline CSS, no external
// requests) for one period: current-standing snapshot per KPI, statistical
// outlier flags, and a short rule-based narrative summary. Deliberately
// framed as a *snapshot*, not a trend — only one reporting period exists so
// far. Once a second period is imported, loadPeriodDataset already has
// everything needed to add real week-over-week trend lines here; this
// generator would just need a second dataset passed in.

import { INDIVIDUAL_METRICS, GATE_METRICS } from "../scoring/thresholds";
import type { PeriodDataset, AgentPeriodResult } from "../data/query";
import { APP_NAME } from "../appConfig";
import { formatDate } from "../utils";

interface OutlierFlag {
  metricName: string;
  agentName: string;
  actualDisplay: string;
  good: boolean; // true = notably ahead of the team, false = notably behind
  zScore: number;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Simple population z-score outlier scan per metric — flags |z| >= 1.5,
 *  direction-aware so "notably ahead" vs "notably behind" is meaningful for
 *  both lower-is-better and higher-is-better metrics. Skips metrics with
 *  fewer than 4 data points or zero variance (not meaningful there). */
function findOutliers(results: AgentPeriodResult[]): OutlierFlag[] {
  const flags: OutlierFlag[] = [];
  for (const def of INDIVIDUAL_METRICS) {
    const points = results
      .map((r) => ({ agent: r.agent.name, m: r.individual.metrics.find((m) => m.key === def.key) }))
      .filter((p): p is { agent: string; m: NonNullable<typeof p.m> } => !!p.m && p.m.actual !== null)
      .map((p) => ({ agent: p.agent, actual: p.m.actual as number, display: p.m.actualDisplay }));

    if (points.length < 4) continue;
    const mean = points.reduce((s, p) => s + p.actual, 0) / points.length;
    const variance = points.reduce((s, p) => s + (p.actual - mean) ** 2, 0) / points.length;
    const stddev = Math.sqrt(variance);
    if (stddev === 0) continue;

    for (const p of points) {
      const z = (p.actual - mean) / stddev;
      if (Math.abs(z) < 1.5) continue;
      const good = def.direction === "lower-is-better" ? p.actual < mean : p.actual > mean;
      flags.push({ metricName: def.name, agentName: p.agent, actualDisplay: p.display, good, zScore: z });
    }
  }
  return flags.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

function buildNarrative(dataset: PeriodDataset, outliers: OutlierFlag[]): string {
  const { results, period, ranked } = dataset;
  const scored = results.length;
  if (scored === 0) return "No agents were scored this period.";

  const teamAverage = results.reduce((s, r) => s + r.individual.finalScore, 0) / scored;
  const onTarget = results.filter((r) => r.individual.finalScore >= 2.4).length;
  const incomplete = results.filter((r) => r.individual.hasIncompleteData).length;
  const gate = results[0]?.gate ?? null;
  const top = ranked[0];

  const sentences: string[] = [];
  sentences.push(
    `For ${period?.label ?? "this period"}, the team averaged ${teamAverage.toFixed(2)} out of 3.00 across ${scored} scored agent${scored === 1 ? "" : "s"}, with ${onTarget} of ${scored} (${Math.round((onTarget / scored) * 100)}%) at or above the 2.40 on-target threshold.`
  );
  if (gate) {
    sentences.push(
      `The Business Gate closed at a ${gate.overallTier} tier this period (${gate.gateMultiplier.toFixed(4)}× multiplier).`
    );
  }
  if (top) {
    sentences.push(`${top.agent.name} led the team with a final score of ${top.individual.finalScore.toFixed(2)}.`);
  }
  if (incomplete > 0) {
    sentences.push(`${incomplete} agent${incomplete === 1 ? " has" : "s have"} at least one metric missing data this period — see the Incomplete flag in the table below.`);
  }
  const good = outliers.filter((o) => o.good).length;
  const bad = outliers.filter((o) => !o.good).length;
  if (good === 0 && bad === 0) {
    sentences.push("No statistical outliers were flagged this period — performance across the team was fairly even on every measured metric.");
  } else {
    const parts: string[] = [];
    if (good > 0) parts.push(`${good} standout result${good === 1 ? "" : "s"} notably ahead of the team`);
    if (bad > 0) parts.push(`${bad} result${bad === 1 ? "" : "s"} notably behind the team average and worth a closer look`);
    sentences.push(`This period's outlier scan flagged ${parts.join(" and ")} — see the Outliers section below.`);
  }
  return sentences.join(" ");
}

export function generatePeriodReportHtml(dataset: PeriodDataset): string {
  const { period, results, ranked } = dataset;
  const generatedAt = new Date().toISOString();

  if (!period || results.length === 0) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${APP_NAME} — Report</title></head>
      <body style="font-family:Inter,system-ui,sans-serif;padding:40px;color:#222"><h1>${APP_NAME} — Report</h1>
      <p>No performance data has been imported yet.</p></body></html>`;
  }

  const outliers = findOutliers(results);
  const narrative = buildNarrative(dataset, outliers);
  const gate = results[0]?.gate ?? null;

  const agentRows = ranked
    .map((r, i) => {
      const flagsForAgent = outliers.filter((o) => o.agentName === r.agent.name);
      const flagBadges = flagsForAgent
        .map(
          (f) =>
            `<span style="display:inline-block;margin:1px 3px 1px 0;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600;background:${f.good ? "#e7f6ee" : "#fdecec"};color:${f.good ? "#1c7a4d" : "#b3261e"}">${escapeHtml(f.metricName.split(" ").slice(0, 2).join(" "))}</span>`
        )
        .join("");
      const metricCells = INDIVIDUAL_METRICS.map((def) => {
        const m = r.individual.metrics.find((x) => x.key === def.key);
        return `<td style="padding:8px 10px;color:#555;white-space:nowrap">${escapeHtml(m?.actualDisplay ?? "—")}</td>`;
      }).join("");
      return `<tr style="border-top:1px solid #e5e7eb;${i < 3 ? "background:#fbfaf5" : ""}">
        <td style="padding:8px 10px;font-weight:700;color:#8a6d1a">${i + 1}</td>
        <td style="padding:8px 10px;font-weight:600;color:#1a1d29">${escapeHtml(r.agent.name)}${r.individual.hasIncompleteData ? ' <span style="font-size:11px;color:#9a7b12;font-weight:500">(incomplete)</span>' : ""}</td>
        <td style="padding:8px 10px;font-weight:700;color:#1a1d29">${r.individual.finalScore.toFixed(2)}</td>
        ${metricCells}
        <td style="padding:8px 10px">${flagBadges || '<span style="color:#9aa0ab">—</span>'}</td>
      </tr>`;
    })
    .join("");

  const gateRows = gate
    ? GATE_METRICS.map((def) => {
        const m = gate.metrics.find((x) => x.key === def.key);
        return `<tr style="border-top:1px solid #e5e7eb">
          <td style="padding:8px 10px;color:#1a1d29">${escapeHtml(def.name)}</td>
          <td style="padding:8px 10px;color:#555">${escapeHtml(m?.actualDisplay ?? "No data")}</td>
          <td style="padding:8px 10px;font-weight:600;color:${tierColor(m?.tier ?? null)}">${m?.tier ?? "n/a"}</td>
          <td style="padding:8px 10px;color:#555">${(def.weight * 100).toFixed(0)}%</td>
        </tr>`;
      }).join("")
    : "";

  const outlierList =
    outliers.length === 0
      ? `<p style="color:#6b7280;font-size:13px">No statistical outliers (|z| ≥ 1.5) were found on any individual metric this period.</p>`
      : `<table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.03em">
            <th style="padding:6px 10px">Agent</th><th style="padding:6px 10px">Metric</th><th style="padding:6px 10px">Value</th><th style="padding:6px 10px">Flag</th>
          </tr></thead>
          <tbody>
            ${outliers
              .map(
                (o) => `<tr style="border-top:1px solid #e5e7eb">
                  <td style="padding:6px 10px;font-weight:600;color:#1a1d29">${escapeHtml(o.agentName)}</td>
                  <td style="padding:6px 10px;color:#555">${escapeHtml(o.metricName)}</td>
                  <td style="padding:6px 10px;color:#555">${escapeHtml(o.actualDisplay)}</td>
                  <td style="padding:6px 10px;font-weight:600;color:${o.good ? "#1c7a4d" : "#b3261e"}">${o.good ? "Ahead of team" : "Behind team"}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>`;

  const metricHeaderCells = INDIVIDUAL_METRICS.map(
    (def) => `<th style="padding:6px 10px;white-space:nowrap">${escapeHtml(def.name.split(" ").slice(0, 3).join(" "))}</th>`
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(APP_NAME)} — ${escapeHtml(period.label)} Report</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Inter,system-ui,-apple-system,sans-serif;color:#1a1d29;">
  <div style="max-width:880px;margin:0 auto;padding:32px 24px 60px;">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:4px;">
      <h1 style="font-size:20px;margin:0;">${escapeHtml(APP_NAME)}</h1>
      <span style="font-size:12px;color:#6b7280;">Generated ${formatDate(generatedAt)}</span>
    </div>
    <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">Performance snapshot — ${escapeHtml(period.label)}</p>

    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:20px 22px;margin-bottom:20px;">
      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#3b5bdb;">This week at a glance</p>
      <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#333;">${escapeHtml(narrative)}</p>
    </div>

    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:0;margin-bottom:20px;overflow:hidden;">
      <div style="padding:16px 20px 4px;">
        <p style="margin:0;font-size:14px;font-weight:700;">Individual Scorecard standing — this period</p>
        <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">Ranked by final score. This is a single-period snapshot, not a trend — trend lines will appear here automatically once a second period is imported.</p>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">
          <thead>
            <tr style="text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.03em;">
              <th style="padding:8px 10px;">#</th>
              <th style="padding:8px 10px;">Agent</th>
              <th style="padding:8px 10px;">Score</th>
              ${metricHeaderCells}
              <th style="padding:8px 10px;">Outlier flags</th>
            </tr>
          </thead>
          <tbody>${agentRows}</tbody>
        </table>
      </div>
    </div>

    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;">Business Gate — team-level metrics</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.03em;">
            <th style="padding:6px 10px;">Metric</th><th style="padding:6px 10px;">Actual</th><th style="padding:6px 10px;">Tier</th><th style="padding:6px 10px;">Weight</th>
          </tr>
        </thead>
        <tbody>${gateRows}</tbody>
      </table>
    </div>

    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;">Outliers this period</p>
      <p style="margin:0 0 10px;font-size:12px;color:#6b7280;">Agents whose value on a metric sits at least 1.5 standard deviations from the team average on that metric this period.</p>
      ${outlierList}
    </div>

    <p style="font-size:11px;color:#9aa0ab;line-height:1.6;">
      Generated by ${escapeHtml(APP_NAME)}. Scores and tiers are derived from the KYC KPI Realignment Framework —
      see Settings → Data Notes in the app for every assumption/judgment call behind these numbers.
    </p>
  </div>
</body>
</html>`;
}

function tierColor(tier: string | null): string {
  switch (tier) {
    case "Exceptional":
      return "#3b5bdb";
    case "Green":
      return "#1c7a4d";
    case "Amber":
      return "#b45309";
    case "Red":
      return "#b3261e";
    default:
      return "#6b7280";
  }
}
