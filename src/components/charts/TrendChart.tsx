"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendPoint {
  period: string;
  /** Null = no data for this point — the line breaks rather than dropping
   *  to 0 or fabricating a value, same "gap over guess" rule MetricTrendChart
   *  already applies elsewhere on this page. */
  score: number | null;
  target?: number;
}

export interface TrendChartProps {
  data: TrendPoint[];
  /** Y-axis domain and the ticks drawn on it — defaults to the 0–3 final
   *  score scale this chart was originally built for. Pass a tighter
   *  domain (e.g. the Business Gate multiplier's documented [0.50, 1.15]
   *  range) for a metric with a narrower natural range, so its
   *  point-to-point movement isn't flattened against a domain sized for a
   *  different metric. */
  domain?: [number, number];
  ticks?: number[];
  /** Decimal places shown on the end-of-line callout and in the tooltip. */
  precision?: number;
  /** Text appended after the formatted number, e.g. "×" for a multiplier. */
  suffix?: string;
  /** Tooltip series name. */
  tooltipLabel?: string;
}

const TICK_STYLE = { fontSize: 12, fill: "hsl(220 10% 46%)" };
const LINE_COLOR = "hsl(226 64% 52%)"; // primary — single series, so identity comes from the title, not a legend

// A single filled dot at the last point that actually has data — the one
// point worth calling out directly (the reader already has "current vs
// last period" as a number above this chart; the chart's job is the shape
// of the trend). Anchored to the last non-null point rather than the last
// array index, so a trailing gap (this period's report not imported yet)
// never leaves the callout pointing at nothing.
function EndDot(props: any) {
  const { cx, cy, index, payload, lastDataIndex, precision, suffix } = props;
  if (index !== lastDataIndex || cx == null || cy == null || payload.score == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill="hsl(0 0% 100%)" />
      <circle cx={cx} cy={cy} r={5} fill={LINE_COLOR} />
      <text x={cx} y={cy - 14} textAnchor="middle" fontSize={12} fontWeight={600} fill="hsl(222 30% 12%)">
        {payload.score.toFixed(precision)}
        {suffix}
      </text>
    </g>
  );
}

export function TrendChart({
  data,
  domain = [0, 3],
  ticks = [0, 1, 2, 3],
  precision = 2,
  suffix = "",
  tooltipLabel = "Team average",
}: TrendChartProps) {
  let lastDataIndex = -1;
  data.forEach((d, i) => {
    if (d.score != null) lastDataIndex = i;
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LINE_COLOR} stopOpacity={0.12} />
            <stop offset="100%" stopColor={LINE_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" stroke="hsl(220 14% 92%)" vertical={false} />
        <XAxis dataKey="period" tick={TICK_STYLE} axisLine={{ stroke: "hsl(220 14% 90%)" }} tickLine={false} />
        <YAxis domain={domain} ticks={ticks} tick={TICK_STYLE} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          cursor={{ stroke: "hsl(220 14% 80%)", strokeWidth: 1 }}
          formatter={(value: number | null) => [
            value == null ? "No data" : `${value.toFixed(precision)}${suffix}`,
            tooltipLabel,
          ]}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid hsl(220 14% 90%)",
            fontSize: 12,
            boxShadow: "0 4px 24px -4px rgb(16 24 40 / 0.12)",
          }}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke={LINE_COLOR}
          strokeWidth={2}
          fill="url(#trendFill)"
          connectNulls={false}
          dot={(props: any) => (
            <EndDot key={props.index} {...props} lastDataIndex={lastDataIndex} precision={precision} suffix={suffix} />
          )}
          activeDot={{ r: 5, fill: LINE_COLOR, stroke: "hsl(0 0% 100%)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
