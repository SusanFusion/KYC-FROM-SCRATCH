// What data feeds each Business Gate metric, in one short line each. One source
// of truth shared by the in-app "i" pop-up (GateInfoButton) and the Weekly / MTD
// report pop-up (reports/gateReferenceHtml.ts), so the two can never describe a
// metric differently.
//
// The weights are read from GATE_METRICS (thresholds.ts) rather than retyped
// here. To change what a pop-up says about a metric, edit the text below --
// nothing else needs touching.

import { GATE_METRICS } from "./thresholds";
import type { GateMetricKey } from "./types";

export interface GateMetricSource {
  key: GateMetricKey;
  /** Short name used in tables. */
  label: string;
  /** Weight inside the Business Gate, 0-1 (from GATE_METRICS). */
  weight: number;
  /** How the figure is measured, in one short line. */
  measures: string;
  /** The system the figure is recorded in. */
  source: string;
}

const TEXT: Record<GateMetricKey, { label: string; measures: string; source: string }> = {
  clientAvgWaitTime: {
    label: "Client Avg Wait Time",
    measures: "Application received until approved or declined on the IDV page, including time waiting on other departments. All statuses.",
    source: "HEX",
  },
  teamProcessingTime: {
    label: "Team Processing Time",
    measures: "Same start and end, but only applications that stayed in CS or KYC status.",
    source: "HEX",
  },
  chatTeamAvgResponse: {
    label: "Chat Team Avg Response",
    measures: "Client's last chat response until the assigned agent's next response.",
    source: "Freshdesk Analytics",
  },
  teamTicketAHT: {
    label: "Team Ticket AHT",
    measures: "Agent starts working the ticket until it is Resolved or Closed, or set to Waiting for another department. Includes KYB application tickets.",
    source: "Freshdesk Analytics",
  },
};

export function getGateMetricSources(): GateMetricSource[] {
  return GATE_METRICS.map((m) => {
    const t = TEXT[m.key as GateMetricKey];
    return { key: m.key as GateMetricKey, label: t.label, weight: m.weight, measures: t.measures, source: t.source };
  });
}
