import { TopHeader } from "@/components/layout/TopHeader";
import { PageShell } from "@/components/layout/PageShell";
import { PasswordGate } from "@/components/shared/PasswordGate";
import { RangePicker } from "@/components/shared/RangePicker";
import { EmptyState } from "@/components/shared/EmptyState";
import { RawDataWorkspace } from "@/components/raw-data/RawDataWorkspace";
import { getRepository } from "@/lib/data/repository";
import { getDailyPeriods, listAvailableMonths } from "@/lib/data/query";
import { mergeRawValues, type RawValues } from "@/lib/data/rawDataFields";
import type { RawAgentMetrics } from "@/lib/scoring/types";
import type { RawDataRow } from "@/components/raw-data/RawDataWorkspace";

// Raw KPI values are read fresh on every request -- an edit or delete made on
// this page has to show up immediately, here and on every other page.
export const dynamic = "force-dynamic";

export default async function RawDataPage({ searchParams }: { searchParams: { month?: string } }) {
  const months = await listAvailableMonths();

  if (months.length === 0) {
    return (
      <>
        <TopHeader title="Raw Data" description="Edit or delete individual KPI entries, with a recorded reason" />
        <PageShell>
          <EmptyState
            title="No daily imports yet"
            description="Import at least one day's report to see its raw KPI entries here."
            actionLabel="Go to Data Import"
            actionHref="/import"
          />
        </PageShell>
      </>
    );
  }

  const selectedMonth = months.find((m) => m.key === searchParams.month) ?? months[0]!;

  const repo = await getRepository();
  const [agents, periods, imports] = await Promise.all([repo.getAgents(), repo.getPeriods(), repo.getImports()]);

  // Oldest import first within a day, so the most recent value per field wins
  // -- the same rule every score is built from (see mergeRawValues).
  const stampByPeriod = new Map<string, string>();
  for (const imp of imports) {
    if (!imp.periodId) continue;
    const stamp = imp.committedAt ?? imp.uploadedAt;
    const prev = stampByPeriod.get(imp.periodId);
    if (!prev || stamp > prev) stampByPeriod.set(imp.periodId, stamp);
  }

  const monthPeriods = getDailyPeriods(periods)
    .filter((p) => p.startDate >= selectedMonth.start && p.endDate <= selectedMonth.end)
    .sort((a, b) => {
      const sa = stampByPeriod.get(a.id) ?? "";
      const sb = stampByPeriod.get(b.id) ?? "";
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });

  const rowsByPeriod = new Map<string, RawAgentMetrics[]>();
  await Promise.all(
    monthPeriods.map(async (p) => {
      rowsByPeriod.set(p.id, await repo.getRawMetrics(p.id));
    })
  );

  // date -> agentId -> that agent's rows for the day (one per import that touched them)
  const byDate = new Map<string, Map<string, RawAgentMetrics[]>>();
  for (const p of monthPeriods) {
    const dayMap = byDate.get(p.startDate) ?? new Map<string, RawAgentMetrics[]>();
    for (const row of rowsByPeriod.get(p.id) ?? []) {
      const list = dayMap.get(row.agentId) ?? [];
      list.push(row);
      dayMap.set(row.agentId, list);
    }
    byDate.set(p.startDate, dayMap);
  }

  const agentName = new Map(agents.map((a) => [a.id, a.name]));
  const latestDate = [...byDate.keys()].sort().pop() ?? "";

  const rows: RawDataRow[] = [];
  for (const [date, dayMap] of byDate) {
    for (const [agentId, agentRows] of dayMap) {
      const values: RawValues = mergeRawValues(agentRows);
      // A row that exists but carries no individual numbers at all (e.g. left
      // behind by a team-level-only import) has nothing to edit or delete.
      if (Object.values(values).every((v) => v === null)) continue;
      rows.push({
        key: `${date}|${agentId}`,
        date,
        agentId,
        agentName: agentName.get(agentId) ?? agentId,
        values,
        isLatestDate: date === latestDate,
      });
    }
  }
  rows.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.agentName.localeCompare(b.agentName)));

  const monthPicker = (
    <RangePicker paramName="month" current={selectedMonth.key} options={months.map((m) => ({ value: m.key, label: m.label }))} />
  );

  return (
    <>
      <TopHeader
        title="Raw Data"
        description={`Individual KPI entries for ${selectedMonth.label} — edit or delete, with a reason recorded for every change`}
        actions={monthPicker}
      />
      <PageShell>
        <PasswordGate description="Enter the shared Lead/Manager password to edit or delete raw KPI data.">
          <RawDataWorkspace rows={rows} monthLabel={selectedMonth.label} />
        </PasswordGate>
      </PageShell>
    </>
  );
}
