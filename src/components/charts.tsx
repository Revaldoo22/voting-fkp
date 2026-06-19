"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const fmtDay = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });

export function PointGrowthChart({
  data,
}: {
  data: { day: string; cumulative: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="pts" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(221 83% 53%)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="hsl(221 83% 53%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="day" tickFormatter={fmtDay} fontSize={12} />
        <YAxis fontSize={12} allowDecimals={false} />
        <Tooltip
          labelFormatter={(l) => fmtDay(l as string)}
          formatter={(v) => [`${v} poin`, "Kumulatif"]}
        />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke="hsl(221 83% 53%)"
          fill="url(#pts)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DailyVotesChart({
  data,
}: {
  data: { day: string; votes: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="day" tickFormatter={fmtDay} fontSize={12} />
        <YAxis fontSize={12} allowDecimals={false} />
        <Tooltip
          labelFormatter={(l) => fmtDay(l as string)}
          formatter={(v) => [`${v} vote`, "Harian"]}
        />
        <Bar dataKey="votes" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VoterGrowthChart({
  data,
}: {
  data: { day: string; cumulative: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="day" tickFormatter={fmtDay} fontSize={12} />
        <YAxis fontSize={12} allowDecimals={false} />
        <Tooltip
          labelFormatter={(l) => fmtDay(l as string)}
          formatter={(v) => [`${v} voter`, "Kumulatif"]}
        />
        <Line
          type="monotone"
          dataKey="cumulative"
          stroke="hsl(221 83% 53%)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TopParticipantsChart({
  data,
}: {
  data: { name: string; total_points: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" fontSize={12} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          fontSize={12}
          width={110}
          tickFormatter={(n: string) => (n.length > 14 ? n.slice(0, 13) + "…" : n)}
        />
        <Tooltip formatter={(v) => [`${v} poin`, "Total"]} />
        <Bar dataKey="total_points" fill="hsl(221 83% 53%)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
