"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";

export interface MetricBarDatum {
  name: string;
  value: number;
  target?: number;
  color: string;
}

const TICK_STYLE = { fontSize: 12, fill: "hsl(220 10% 46%)" };

export function MetricBarChart({ data, unitSuffix = "" }: { data: MetricBarDatum[]; unitSuffix?: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 90%)" vertical={false} />
        <XAxis dataKey="name" tick={TICK_STYLE} axisLine={{ stroke: "hsl(220 14% 90%)" }} tickLine={false} />
        <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          formatter={(value: number) => `${value}${unitSuffix}`}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid hsl(220 14% 90%)",
            fontSize: 12,
            boxShadow: "0 4px 24px -4px rgb(16 24 40 / 0.12)",
          }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
