"use client";

import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface MetricTrendPoint {
  label: string;
  /** Null = no data that point — the line breaks rather than dropping to 0
   *  or interpolating, so a gap in imports reads as a gap, not a dip. */
  value: number | null;
  display: string;
}

const LINE_COLOR = "hsl(226 64% 52%)";
const TICK_STYLE = { fontSize: 11, fill: "hsl(220 10% 46%)" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderValueDot(props: any) {
  const { cx, cy, payload, index } = props;
  if (cx == null || cy == null || payload?.value == null) return <g key={index} />;
  return <circle key={index} cx={cx} cy={cy} r={3} fill={LINE_COLOR} stroke="hsl(0 0% 100%)" strokeWidth={1} />;
}

/** A small single-series line chart shared by the Trends page's weekly
 *  Business Gate charts and daily per-officer KPI charts — same visual
 *  language as TrendChart (the team-average area chart above it) but
 *  lighter-weight and reusable across many small charts on one page. */
export function MetricTrendChart({ data, height = 160 }: { data: MetricTrendPoint[]; height?: number }) {
  const hasAnyData = data.some((d) => d.value !== null);

  if (!hasAnyData) {
    return (
      <div className="flex items-center justify-center text-xs text-muted-foreground" style={{ height }}>
        No data for this range yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="0" stroke="hsl(220 14% 92%)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={TICK_STYLE}
          axisLine={{ stroke: "hsl(220 14% 90%)" }}
          tickLine={false}
          minTickGap={20}
        />
        <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} width={38} domain={["auto", "auto"]} allowDecimals />
        <Tooltip
          formatter={(_value: number, _name: string, item: { payload?: MetricTrendPoint }) => [
            item.payload?.display ?? "No data",
            "Actual",
          ]}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid hsl(220 14% 90%)",
            fontSize: 12,
            boxShadow: "0 4px 24px -4px rgb(16 24 40 / 0.12)",
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={LINE_COLOR}
          strokeWidth={2}
          dot={renderValueDot}
          activeDot={{ r: 5, fill: LINE_COLOR, stroke: "hsl(0 0% 100%)", strokeWidth: 2 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
