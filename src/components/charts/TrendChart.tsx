"use client";

import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

export interface TrendPoint {
  period: string;
  score: number;
  target?: number;
}

const TICK_STYLE = { fontSize: 12, fill: "hsl(220 10% 46%)" };

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 90%)" vertical={false} />
        <XAxis dataKey="period" tick={TICK_STYLE} axisLine={{ stroke: "hsl(220 14% 90%)" }} tickLine={false} />
        <YAxis domain={[0, 3]} tick={TICK_STYLE} axisLine={false} tickLine={false} width={30} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid hsl(220 14% 90%)",
            fontSize: 12,
            boxShadow: "0 4px 24px -4px rgb(16 24 40 / 0.12)",
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="score" name="Team Average Score" stroke="hsl(226 64% 52%)" strokeWidth={2.5} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
