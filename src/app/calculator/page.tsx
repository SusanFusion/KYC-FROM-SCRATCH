import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { ScoreCalculator, type CalculatorAgent } from "@/components/calculator/ScoreCalculator";
import { loadRangeDataset, listAvailableMonths } from "@/lib/data/query";
import { INDIVIDUAL_METRICS } from "@/lib/scoring/thresholds";
import type { IndividualMetricKey } from "@/lib/scoring/types";
import { formatDate } from "@/lib/utils";

// The "compare with my month to date" box reads live scores, so this page is
// built fresh on every request like the other score pages.
export const dynamic = "force-dynamic";

export default async function CalculatorPage() {
  let agents: CalculatorAgent[] = [];
  let monthLabel: string | null = null;

  // The calculator itself needs no data. If the live scores can't be loaded the
  // page still works; it just doesn't offer the comparison.
  try {
    const month = (await listAvailableMonths())[0];
    if (month) {
      monthLabel = `${month.label} (thru ${formatDate(month.end)})`;
      const { results } = await loadRangeDataset({
        start: month.start,
        end: month.end,
        label: monthLabel,
        id: `mtd-${month.key}`,
        type: "month-to-date",
      });
      agents = results
        // Same exclusion as Overall MTD: an agent with nothing imported yet has no real score.
        .filter((r) => r.individual.effectiveWeight > 0)
        .map((r) => {
          const values = {} as Record<IndividualMetricKey, number | null>;
          for (const def of INDIVIDUAL_METRICS) values[def.key] = null;
          for (const m of r.individual.metrics) values[m.key] = m.actual;
          return {
            id: r.agent.id,
            name: r.agent.name,
            finalScore: r.individual.finalScore,
            baseScore: r.individual.baseScore,
            penaltyTotal: r.individual.penaltyTotal,
            values,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch {
    agents = [];
    monthLabel = null;
  }

  return (
    <>
      <TopHeader title="Score Calculator" description="Type your KPI figures to see the score you would get on the monthly scorecard" />
      <PageShell>
        <ScoreCalculator agents={agents} monthLabel={monthLabel} />
      </PageShell>
    </>
  );
}
