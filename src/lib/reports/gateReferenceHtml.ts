// Shared "How the Business Gate is calculated" reference card, appended to both
// the Weekly Report and the MTD Report so anyone reading an exported file can
// see what the gate is, how each number is graded and combined, and how this
// report's own gate figure was reached, without opening the app.
//
// Everything printed here is read from the same constants the scoring engine
// itself uses (GATE_METRICS weights/bands, GATE_TIER_SCORES, the multiplier
// limits), so if a threshold or weight is ever changed in thresholds.ts this
// card changes with it instead of going stale.

import { GATE_TIER_SCORES, GATE_MULTIPLIER_MIN, GATE_MULTIPLIER_MAX } from "../scoring/thresholds";
import { buildGateScaleTable } from "../scoring/display";
import type { BusinessGateResult, GateMetricKey, GateTier } from "../scoring/types";

const COLOR = {
  primary: "hsl(226 64% 52%)",
  muted: "#6b7280",
  border: "#e5e7eb",
  ink: "#1a1d29",
};

const TIER_COLOR: Record<GateTier, string> = {
  Exceptional: "#1565c0",
  Green: "#1b5e20",
  Amber: "#e65100",
  Red: "#b71c1c",
};

const SHORT_LABEL: Record<GateMetricKey, string> = {
  clientAvgWaitTime: "Client Avg Wait Time",
  teamProcessingTime: "Team Processing Time",
  chatTeamAvgResponse: "Chat Team Avg Response",
  teamTicketAHT: "Team Ticket AHT",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pct(weight: number): string {
  return `${Math.round(weight * 100)}%`;
}

export interface GateReferenceOptions {
  /** This report's own gate result, used for the worked calculation. */
  gate: BusinessGateResult | null;
  /** "week" or "month" -- only changes the wording of the averaging note. */
  scope: "week" | "month";
  /** e.g. "Sep 27 – Oct 3, 2026" or "October 2026". */
  periodLabel: string;
}

export function renderGateReference(opts: GateReferenceOptions): string {
  const { gate, scope, periodLabel } = opts;
  const span = scope === "week" ? "the days of the week" : "every day imported so far this month";

  const scale = buildGateScaleTable();
  const scaleHead = scale.columns
    .map((c) => `<th style="padding:6px 10px;color:${TIER_COLOR[c.columnLabel as GateTier] ?? COLOR.muted};">${escapeHtml(c.columnLabel)}</th>`)
    .join("");
  const scaleRows = scale.rows
    .map(
      (r) => `<tr style="border-top:1px solid ${COLOR.border};">
        <td style="padding:7px 10px;color:${COLOR.ink};">${escapeHtml(SHORT_LABEL[r.key as GateMetricKey] ?? r.name)}</td>
        <td style="padding:7px 10px;color:${COLOR.muted};">${pct(r.weight)}</td>
        ${r.cells.map((cell) => `<td style="padding:7px 10px;color:${COLOR.ink};">${escapeHtml(cell)}</td>`).join("")}
      </tr>`
    )
    .join("");

  const tierScoreLine = GATE_TIER_SCORES.map(
    (t) => `<span style="color:${TIER_COLOR[t.tier]};font-weight:700;">${t.tier} = ${t.score.toFixed(2)}</span>`
  ).join(" &nbsp;·&nbsp; ");

  // ── This report's own calculation ────────────────────────────────────
  let worked = "";
  if (gate) {
    const counted = gate.metrics.filter((m) => m.weightedContribution !== null);
    const sumContribution = counted.reduce((s, m) => s + (m.weightedContribution ?? 0), 0);
    const weightCounted = counted.reduce((s, m) => s + m.weight, 0);
    const rows = gate.metrics
      .map((m) => {
        const label = SHORT_LABEL[m.key] ?? m.name;
        if (m.weightedContribution === null || m.tier === null || m.tierScore === null) {
          return `<tr style="border-top:1px solid ${COLOR.border};">
            <td style="padding:7px 10px;color:${COLOR.ink};">${escapeHtml(label)}</td>
            <td style="padding:7px 10px;color:${COLOR.muted};" colspan="5"><em>No data for this period, so it is left out and the other weights are scaled up to fill 100%. It is never counted as zero.</em></td>
          </tr>`;
        }
        return `<tr style="border-top:1px solid ${COLOR.border};">
          <td style="padding:7px 10px;color:${COLOR.ink};">${escapeHtml(label)}</td>
          <td style="padding:7px 10px;color:${COLOR.ink};font-weight:600;">${escapeHtml(m.actualDisplay)}</td>
          <td style="padding:7px 10px;color:${TIER_COLOR[m.tier]};font-weight:600;">${escapeHtml(m.tier)}</td>
          <td style="padding:7px 10px;color:${COLOR.ink};">${m.tierScore.toFixed(2)}</td>
          <td style="padding:7px 10px;color:${COLOR.muted};">× ${pct(m.weight)}</td>
          <td style="padding:7px 10px;color:${COLOR.ink};font-weight:600;">${m.weightedContribution.toFixed(4)}</td>
        </tr>`;
      })
      .join("");
    worked = `
      <p style="margin:18px 0 6px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${COLOR.muted};">This report's calculation — ${escapeHtml(periodLabel)}</p>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="text-align:left;color:${COLOR.muted};font-size:10px;text-transform:uppercase;letter-spacing:.03em;">
            <th style="padding:6px 10px;">Metric</th><th style="padding:6px 10px;">Value used</th><th style="padding:6px 10px;">Tier</th><th style="padding:6px 10px;">Tier score</th><th style="padding:6px 10px;">Weight</th><th style="padding:6px 10px;">Contribution</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p style="margin:10px 0 0;font-size:12px;color:${COLOR.ink};">
        Sum of contributions <strong>${sumContribution.toFixed(4)}</strong> ÷ weight counted <strong>${pct(weightCounted)}</strong>
        = Gate multiplier <strong style="color:${TIER_COLOR[gate.overallTier]};">${gate.gateMultiplier.toFixed(4)}×</strong>
        (<strong style="color:${TIER_COLOR[gate.overallTier]};">${(gate.gateMultiplier * 100).toFixed(2)}% · ${escapeHtml(gate.overallTier)}</strong>)
      </p>`;
  }

  return `
    <div style="background:#fff;border:1px solid ${COLOR.border};border-left:4px solid ${COLOR.muted};border-radius:10px;padding:20px 22px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${COLOR.ink};">ℹ️ How the Business Gate is calculated</p>
      <p style="margin:0 0 14px;font-size:12px;color:${COLOR.muted};">Reference for the Gate figures in this report.</p>

      <p style="margin:0 0 6px;font-size:13px;color:${COLOR.ink};"><strong>What it is.</strong> The Business Gate is a team-level multiplier, not an individual score. It reflects how the whole KYC team performed on four service measures, and it is applied to every agent's bonus (the agent's own score sets the bonus bracket first, then the Gate multiplier scales it). 100% means the bonus is paid as is; above 100% increases it, below 100% reduces it.</p>

      <p style="margin:12px 0 6px;font-size:13px;font-weight:700;color:${COLOR.ink};">How it is worked out</p>
      <ol style="margin:0;padding-left:20px;font-size:12px;color:${COLOR.ink};line-height:1.6;">
        <li>Take the four team metrics for the period (see "Where the numbers come from" below).</li>
        <li>Grade each metric into a tier using the scale below. For all four, lower is better.</li>
        <li>Turn each tier into a tier score: ${tierScoreLine}.</li>
        <li>Multiply each tier score by that metric's weight and add the results together.</li>
        <li>If a metric has no data for the period it is left out and the remaining weights are scaled back up to 100%. Missing data is never counted as zero.</li>
        <li>The result is the Gate multiplier, kept between ${GATE_MULTIPLIER_MIN.toFixed(2)} and ${GATE_MULTIPLIER_MAX.toFixed(2)} and shown as a percentage (1.00 = 100%). Overall status: 115% or more is Exceptional, 100% to under 115% is Green, 70% to under 100% is Amber, and under 70% is Red.</li>
      </ol>

      <p style="margin:16px 0 6px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${COLOR.muted};">Weights and tier scale</p>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.03em;">
            <th style="padding:6px 10px;color:${COLOR.muted};">Metric</th><th style="padding:6px 10px;color:${COLOR.muted};">Weight</th>${scaleHead}
          </tr></thead>
          <tbody>${scaleRows}</tbody>
        </table>
      </div>
      ${worked}

      <p style="margin:18px 0 6px;font-size:13px;font-weight:700;color:${COLOR.ink};">Where the numbers come from</p>
      <ul style="margin:0;padding-left:20px;font-size:12px;color:${COLOR.ink};line-height:1.6;">
        <li>Each day's four gate figures are taken from the daily KYC Team Performance report imported for that day (or entered by hand on the Manual Entry page).</li>
        <li>For ${span}, Client Avg Wait Time and Team Processing Time are the plain average of the daily values.</li>
        <li>Chat Team Avg Response is the average of the daily values weighted by each day's chat volume, and Team Ticket AHT is weighted by each day's email and KYB ticket volume (application tickets are not included), so busier days count for more. The tier is graded on these weighted figures, which can differ slightly from a plain average of the daily entries.</li>
        <li>A day imported more than once counts once; for each figure the most recent import with a value is used.</li>
        <li>The Gate is recalculated from the stored daily data each time a report is exported, so a report reflects the data as it stood when it was generated. If a day is corrected or re-imported later, a newer export of the same period can differ from an older one.</li>
      </ul>
    </div>`;
}
