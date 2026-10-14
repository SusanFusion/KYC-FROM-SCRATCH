// What data feeds each Business Gate metric, in plain words. One source of
// truth shared by the in-app "i" pop-up (GateInfoButton) and the Weekly / MTD
// report pop-up (reports/gateReferenceHtml.ts), so the two can never describe a
// metric differently.
//
// The names and weights are read from GATE_METRICS (thresholds.ts) rather than
// retyped here. The wording for "measures" / "source" / "combined" follows how
// the figures are actually imported and aggregated (pdfImportParser.ts reads the
// four KPI cards of the daily KYC Team Performance report; query.ts's
// aggregateGate combines the days). To change what a report says about a
// metric, edit the text below -- nothing else needs touching.

import { GATE_METRICS } from "./thresholds";
import type { GateMetricKey } from "./types";

export interface GateMetricSource {
  key: GateMetricKey;
  /** Short name used in tables. */
  label: string;
  /** The framework's full name for the metric (from GATE_METRICS). */
  officialName: string;
  /** Weight inside the Business Gate, 0-1 (from GATE_METRICS). */
  weight: number;
  /** What the figure measures. */
  measures: string;
  /** Where the daily figure comes from. */
  source: string;
  /** How the daily figures are combined over a week or a month. */
  combined: string;
}

const TEXT: Record<GateMetricKey, { label: string; measures: string; source: string; combined: string }> = {
  clientAvgWaitTime: {
    label: "Client Avg Wait Time",
    measures:
      "Measured from when the application comes in until it is approved or declined on the IDV page, including any time it spends waiting on other departments. Covers applications in all statuses. Shown in minutes.",
    source: "Recorded in HEX. Brought into the app through the “Client Avg Wait Time” card of the daily KYC Team Performance report.",
    combined: "Plain average of the daily values.",
  },
  teamProcessingTime: {
    label: "Team Processing Time",
    measures:
      "Measured the same way, from when the application comes in until it is approved or declined on the IDV page, but only for applications that stayed in CS or KYC status. It reflects how soon applications get actioned at the CS/KYC end. Shown in minutes.",
    source: "Recorded in HEX. Brought into the app through the “Avg Team Processing Time” card of the daily KYC Team Performance report.",
    combined: "Plain average of the daily values.",
  },
  chatTeamAvgResponse: {
    label: "Chat Team Avg Response",
    measures:
      "The average time from the client's last response in a chat until the assigned agent's next response within that conversation, across the team. Shown in seconds.",
    source: "Recorded in Freshdesk Analytics. Brought into the app through the “Chat Team Avg Response Time” card of the daily KYC Team Performance report.",
    combined: "Average of the daily values, weighted by each day's total chat volume.",
  },
  teamTicketAHT: {
    label: "Team Ticket AHT",
    measures:
      "The average time from when the assigned agent starts working on a ticket until it is resolved or closed, or until it is set to Waiting for another department. Includes KYB application tickets. Shown in minutes.",
    source:
      "Recorded in Freshdesk Analytics. Brought into the app through the “Team Ticket Resolution Time” card of the daily KYC Team Performance report (called Team Ticket AHT in this app).",
    combined: "Average of the daily values, weighted by each day's email and KYB ticket volume.",
  },
};

export function getGateMetricSources(): GateMetricSource[] {
  return GATE_METRICS.map((m) => {
    const t = TEXT[m.key as GateMetricKey];
    return { key: m.key as GateMetricKey, label: t.label, officialName: m.name, weight: m.weight, measures: t.measures, source: t.source, combined: t.combined };
  });
}
