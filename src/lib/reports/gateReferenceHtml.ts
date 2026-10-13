// Shared "How the Business Gate is calculated" explainer for both the Weekly
// Report and the MTD Report. The report shows a small clickable "i" button next
// to the Business Gate heading (renderGateInfoButton); clicking it opens a
// pop-up (renderGateReference) that leads with the exact computation of this
// report's own gate figure, then explains what the gate is and how it works.
//
// No JavaScript is used, so it keeps working in an email attachment or a
// double-clicked file: the pop-up is a CSS :target overlay. If a viewer strips
// the <style> block, the explainer simply shows as a normal card on the page
// instead, and when the report is printed or saved as PDF it is printed as a
// normal card too.
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

const MODAL_ID = "gate-info";
const CLOSE_ID = "close-gate-info"; // deliberately matches no element, so closing never scrolls the page

/** The small clickable "i" that sits next to the Business Gate heading. */
export function renderGateInfoButton(): string {
  return `<a class="gate-info-btn" href="#${MODAL_ID}" title="How is the Business Gate calculated?" aria-label="How is the Business Gate calculated?" style="display:inline-block;width:17px;height:17px;line-height:16px;border:1.5px solid ${COLOR.primary};border-radius:50%;color:${COLOR.primary};font:italic 700 12px/16px Georgia,'Times New Roman',serif;text-align:center;text-decoration:none;margin-left:8px;vertical-align:middle;">i</a>`;
}

const STYLES = `
<style>
  .gate-info-modal { display: none; }
  .gate-info-modal:target { display: block; position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 1000; overflow-y: auto; background: rgba(17,24,39,.55); padding: 28px 16px; }
  .gate-info-modal:target .gate-info-backdrop { display: block; position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 0; cursor: default; }
  .gate-info-modal:target .gate-info-panel { position: relative; z-index: 1; max-width: 820px; margin: 0 auto; box-shadow: 0 20px 50px rgba(0,0,0,.35); }
  .gate-info-btn:hover { background: ${COLOR.primary}; color: #fff !important; }
  .gate-info-close { float: right; font-size: 12px; font-weight: 600; text-decoration: none; color: ${COLOR.muted}; border: 1px solid ${COLOR.border}; border-radius: 6px; padding: 3px 9px; }
  .gate-info-close:hover { background: #f3f4f6; }
  .gate-info-backdrop { display: none; }
  @media print {
    .gate-info-modal, .gate-info-modal:target { display: block !important; position: static !important; background: none !important; padding: 0 !important; overflow: visible !important; }
    .gate-info-backdrop, .gate-info-close, .gate-info-btn { display: none !important; }
    .gate-info-modal .gate-info-panel { box-shadow: none !important; max-width: none !important; margin: 0 0 20px !important; page-break-inside: auto; }
  }
</style>`;

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

  function bandFor(key: GateMetricKey, tier: string): string {
    const colIndex = scale.columns.findIndex((c) => c.columnLabel === tier);
    const row = scale.rows.find((r) => r.key === key);
    return colIndex >= 0 && row ? (row.cells[colIndex] ?? "") : "";
  }

  // ── This report's own calculation (leads the pop-up) ─────────────────
  let worked = "";
  if (gate) {
    const counted = gate.metrics.filter((m) => m.weightedContribution !== null);
    const sumContribution = counted.reduce((s, m) => s + (m.weightedContribution ?? 0), 0);
    const weightCounted = counted.reduce((s, m) => s + m.weight, 0);
    const rawMultiplier = weightCounted > 0 ? sumContribution / weightCounted : 1;
    const wasClamped = Math.abs(Math.round(rawMultiplier * 10000) / 10000 - gate.gateMultiplier) > 0.00005;
    const sumExpression = counted.map((m) => (m.weightedContribution ?? 0).toFixed(4)).join(" + ");
    const tierColor = TIER_COLOR[gate.overallTier];
    const rows = gate.metrics
      .map((m) => {
        const label = SHORT_LABEL[m.key] ?? m.name;
        if (m.weightedContribution === null || m.tier === null || m.tierScore === null) {
          return `<tr style="border-top:1px solid ${COLOR.border};">
            <td style="padding:7px 10px;color:${COLOR.ink};">${escapeHtml(label)}</td>
            <td style="padding:7px 10px;color:${COLOR.muted};" colspan="4"><em>No data for this period, so it is left out and the other weights are scaled up to fill 100%. It is never counted as zero.</em></td>
          </tr>`;
        }
        return `<tr style="border-top:1px solid ${COLOR.border};vertical-align:top;">
          <td style="padding:7px 10px;color:${COLOR.ink};font-weight:600;">${escapeHtml(label)}</td>
          <td style="padding:7px 10px;color:${COLOR.ink};font-weight:600;white-space:nowrap;">${escapeHtml(m.actualDisplay)}</td>
          <td style="padding:7px 10px;"><span style="color:${TIER_COLOR[m.tier]};font-weight:700;">${escapeHtml(m.tier)}</span><br><span style="font-size:10px;color:${COLOR.muted};white-space:nowrap;">${escapeHtml(bandFor(m.key, m.tier))}</span></td>
          <td style="padding:7px 10px;color:${COLOR.muted};white-space:nowrap;">${m.tierScore.toFixed(2)} × ${pct(m.weight)}</td>
          <td style="padding:7px 10px;color:${COLOR.ink};font-weight:700;text-align:right;">${m.weightedContribution.toFixed(4)}</td>
        </tr>`;
      })
      .join("");
    worked = `
      <div style="text-align:center;background:#f9fafb;border:1px solid ${COLOR.border};border-radius:10px;padding:14px 12px;margin:0 0 14px;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${COLOR.muted};">Gate multiplier — ${escapeHtml(periodLabel)}</p>
        <p style="margin:4px 0 0;font-size:32px;font-weight:800;color:${COLOR.ink};">${gate.gateMultiplier.toFixed(4)}×</p>
        <p style="margin:2px 0 0;font-size:13px;font-weight:700;color:${tierColor};">${(gate.gateMultiplier * 100).toFixed(2)}% · ${escapeHtml(gate.overallTier)}</p>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="text-align:left;color:${COLOR.muted};font-size:10px;text-transform:uppercase;letter-spacing:.03em;">
            <th style="padding:6px 10px;">Metric</th><th style="padding:6px 10px;">Value used</th><th style="padding:6px 10px;">Tier</th><th style="padding:6px 10px;">Score × Weight</th><th style="padding:6px 10px;text-align:right;">Contribution</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="margin-top:10px;border:1px solid ${COLOR.border};border-radius:8px;padding:10px 12px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:${COLOR.muted};line-height:1.7;">
        <div><strong style="color:${COLOR.ink};">Sum of contributions</strong> = ${sumExpression || "—"} = <strong style="color:${COLOR.ink};">${sumContribution.toFixed(4)}</strong></div>
        <div><strong style="color:${COLOR.ink};">Weight counted</strong> = ${pct(weightCounted)}${counted.length < gate.metrics.length ? " (metrics with no data left out)" : ""}</div>
        <div><strong style="color:${COLOR.ink};">Gate multiplier</strong> = ${sumContribution.toFixed(4)} ÷ ${weightCounted.toFixed(2)} = <strong style="color:${tierColor};">${gate.gateMultiplier.toFixed(4)}×</strong></div>
        ${wasClamped ? `<div>The raw result (${rawMultiplier.toFixed(4)}) fell outside the allowed range, so it is held to ${GATE_MULTIPLIER_MIN.toFixed(2)}–${GATE_MULTIPLIER_MAX.toFixed(2)}.</div>` : ""}
      </div>
      <p style="margin:10px 0 0;font-size:12px;color:${COLOR.muted};">This multiplier is applied to every agent's bonus: the agent's own score sets the bonus bracket, then this figure scales it.</p>`;
  }

  return `${STYLES}
    <div id="${MODAL_ID}" class="gate-info-modal">
      <a class="gate-info-backdrop" href="#${CLOSE_ID}" aria-label="Close"></a>
      <div class="gate-info-panel" style="background:#fff;border:1px solid ${COLOR.border};border-left:4px solid ${COLOR.primary};border-radius:10px;padding:20px 22px;margin-bottom:20px;">
        <a class="gate-info-close" href="#${CLOSE_ID}">Close ✕</a>
        <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${COLOR.ink};">ℹ️ ${gate ? "Business Gate — current calculation" : "How the Business Gate is calculated"}</p>
        <p style="margin:0 0 14px;font-size:12px;color:${COLOR.muted};">${gate ? "Exactly how the Gate figure in this report was worked out, followed by how the Gate works." : "Reference for the Gate figures in this report."}</p>

        ${worked}

        <p style="margin:20px 0 6px;font-size:13px;font-weight:700;color:${COLOR.ink};">What it is</p>
        <p style="margin:0 0 6px;font-size:13px;color:${COLOR.ink};">The Business Gate is a team-level multiplier, not an individual score. It reflects how the whole KYC team performed on four service measures, and it is applied to every agent's bonus (the agent's own score sets the bonus bracket first, then the Gate multiplier scales it). 100% means the bonus is paid as is; above 100% increases it, below 100% reduces it.</p>

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

        <p style="margin:18px 0 6px;font-size:13px;font-weight:700;color:${COLOR.ink};">Where the numbers come from</p>
        <ul style="margin:0;padding-left:20px;font-size:12px;color:${COLOR.ink};line-height:1.6;">
          <li>Each day's four gate figures are taken from the daily KYC Team Performance report imported for that day (or entered by hand on the Manual Entry page).</li>
          <li>For ${span}, Client Avg Wait Time and Team Processing Time are the plain average of the daily values.</li>
          <li>Chat Team Avg Response is the average of the daily values weighted by each day's chat volume, and Team Ticket AHT is weighted by each day's email and KYB ticket volume (application tickets are not included), so busier days count for more. The tier is graded on these weighted figures, which can differ slightly from a plain average of the daily entries.</li>
          <li>A day imported more than once counts once; for each figure the most recent import with a value is used.</li>
          <li>The Gate is recalculated from the stored daily data each time a report is exported, so a report reflects the data as it stood when it was generated. If a day is corrected or re-imported later, a newer export of the same period can differ from an older one.</li>
        </ul>
      </div>
    </div>`;
}
