"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendPoint {
  period: string;
  score: number;
  target?: number;
}

const TICK_STYLE = { fontSize: 12, fill: "hsl(220 10% 46%)" };
const LINE_COLOR = "hsl(226 64% 52%)"; // primary — single series, so identity comes from the title, not a legend

// A single filled dot at the very end of the line — the one point worth
// calling out directly (the reader already has "current vs last period" as
// a number above this chart; the chart's job is the shape of the trend).
function EndDot(props: any) {
  const { cx, cy, index, payload, dataLength } = props;
  if (index !== dataLength - 1 || cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill="hsl(0 0% 100%)" />
      <circle cx={cx} cy={cy} r={5} fill={LINE_COLOR} />
      <text x={cx} y={cy - 14} textAnchor="middle" fontSize={12} fontWeight={600} fill="hsl(222 30% 12%)">
        {payload.score.toFixed(2)}
      </text>
    </g>
  );
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
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
        <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tick={TICK_STYLE} axisLine={false} tickLine={false} width={24} />
        <Tooltip
          cursor={{ stroke: "hsl(220 14% 80%)", strokeWidth: 1 }}
          formatter={(value: number) => [value.toFixed(2), "Team average"]}
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
          dot={(props: any) => <EndDot key={props.index} {...props} dataLength={data.length} />}
          activeDot={{ r: 5, fill: LINE_COLOR, stroke: "hsl(0 0% 100%)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
