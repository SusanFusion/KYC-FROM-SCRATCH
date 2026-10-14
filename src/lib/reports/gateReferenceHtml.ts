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
import { getGateMetricSources } from "../scoring/gateMetricSources";
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
  const periodWord = scope === "week" ? "the week" : "the month";

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

  // ── What data each metric uses ───────────────────────────────────────
  const sourceRows = getGateMetricSources()
    .map(
      (m) => `<tr style="border-top:1px solid ${COLOR.border};vertical-align:top;">
        <td style="padding:7px 10px;color:${COLOR.ink};font-weight:600;">${escapeHtml(m.label)}</td>
        <td style="padding:7px 10px;color:${COLOR.ink};">${escapeHtml(m.measures)}</td>
        <td style="padding:7px 10px;color:${COLOR.muted};white-space:nowrap;">${escapeHtml(m.source)}</td>
      </tr>`
    )
    .join("");

  // ── This report's own calculation (leads the pop-up) ─────────────────
  let worked = "";
  if (gate) {
    const counted = gate.metrics.filter((m) => m.weightedContribution !== null);
    const sumContribution = counted.reduce((s, m) => s + (m.weightedContribution ?? 0), 0);
    const weightCounted = counted.reduce((s, m) => s + m.weight, 0);
    const rawMultiplier = weightCounted > 0 ? sumContribution / weightCounted : 1;
    const wasClamped = Math.abs(Math.round(rawMultiplier * 10000) / 10000 - gate.gateMultiplier) > 0.00005;
    const tierColor = TIER_COLOR[gate.overallTier];
    const rows = gate.metrics
      .map((m) => {
        const label = SHORT_LABEL[m.key] ?? m.name;
        if (m.weightedContribution === null || m.tier === null || m.tierScore === null) {
          return `<tr style="border-top:1px solid ${COLOR.border};">
            <td style="padding:7px 10px;color:${COLOR.ink};">${escapeHtml(label)}</td>
            <td style="padding:7px 10px;color:${COLOR.muted};" colspan="4"><em>No data this period, so it is left out (never counted as zero).</em></td>
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
      <p style="margin:10px 0 0;font-size:12px;color:${COLOR.muted};">Sum ${sumContribution.toFixed(4)} ÷ weight counted ${weightCounted.toFixed(2)} = <strong style="color:${tierColor};">${gate.gateMultiplier.toFixed(4)}×</strong>${counted.length < gate.metrics.length ? ". Metrics with no data are left out and the rest scaled up" : ""}${wasClamped ? `. The raw result (${rawMultiplier.toFixed(4)}) is held to ${GATE_MULTIPLIER_MIN.toFixed(2)}–${GATE_MULTIPLIER_MAX.toFixed(2)}` : ""}.</p>`;
  }

  return `${STYLES}
    <div id="${MODAL_ID}" class="gate-info-modal">
      <a class="gate-info-backdrop" href="#${CLOSE_ID}" aria-label="Close"></a>
      <div class="gate-info-panel" style="background:#fff;border:1px solid ${COLOR.border};border-left:4px solid ${COLOR.primary};border-radius:10px;padding:20px 22px;margin-bottom:20px;">
        <a class="gate-info-close" href="#${CLOSE_ID}">Close ✕</a>
        <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:${COLOR.ink};">ℹ️ ${gate ? "Business Gate — current calculation" : "How the Business Gate is calculated"}</p>

        ${worked}

        <p style="margin:16px 0 4px;font-size:13px;font-weight:700;color:${COLOR.ink};">How it works</p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:${COLOR.ink};">The Gate is a team-level multiplier applied to every agent's bonus: 100% pays it as is, above 100% increases it, below 100% reduces it. Each metric is graded into a tier (${tierScoreLine}), multiplied by its weight and added up. A metric with no data is left out and the rest scaled to 100%. The result is kept between ${GATE_MULTIPLIER_MIN.toFixed(2)} and ${GATE_MULTIPLIER_MAX.toFixed(2)}. Lower is better on all four.</p>

        <p style="margin:16px 0 6px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${COLOR.muted};">Weights and tier scale</p>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.03em;">
              <th style="padding:6px 10px;color:${COLOR.muted};">Metric</th><th style="padding:6px 10px;color:${COLOR.muted};">Weight</th>${scaleHead}
            </tr></thead>
            <tbody>${scaleRows}</tbody>
          </table>
        </div>

        <p style="margin:16px 0 6px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${COLOR.muted};">What data each metric uses</p>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr style="text-align:left;color:${COLOR.muted};font-size:10px;text-transform:uppercase;letter-spacing:.03em;">
              <th style="padding:6px 10px;">Metric</th><th style="padding:6px 10px;">Measured from → to</th><th style="padding:6px 10px;">Recorded in</th>
            </tr></thead>
            <tbody>${sourceRows}</tbody>
          </table>
        </div>

        <p style="margin:12px 0 0;font-size:11px;line-height:1.6;color:${COLOR.muted};">Daily figures come from the daily KYC Team Performance report. Over ${periodWord}, wait and processing times are averaged; chat response and ticket AHT are weighted by chat and ticket volume. A day imported twice counts once. Reports reflect the data at the time of export.</p>
      </div>
    </div>`;
}
