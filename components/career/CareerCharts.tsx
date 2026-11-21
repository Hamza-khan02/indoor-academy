'use client';

import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type PerMatch = { label: string; opponent: string; runs: number | null; notOut: boolean; wickets: number | null };
type Rating = { label: string; average: number; batting: number; bowling: number; fielding: number; fitness: number };

const tooltipStyle = { background: '#18181d', border: '1px solid #303039', borderRadius: 10, color: '#fff', fontSize: 12 };
const axis = { fill: '#777781', fontSize: 11 };

export function MatchTrendChart({ data }: { data: PerMatch[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 5" vertical={false} stroke="#25252b" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axis} interval="preserveStartEnd" minTickGap={14} />
        <YAxis yAxisId="runs" axisLine={false} tickLine={false} tick={axis} allowDecimals={false} />
        <YAxis yAxisId="wkts" orientation="right" axisLine={false} tickLine={false} tick={axis} allowDecimals={false} width={24} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(label, items: any) => `${label} vs ${items?.[0]?.payload?.opponent ?? ''}`}
          formatter={(v: number, name: string, item: any) => (name === 'Runs' && item.payload.notOut ? [`${v}*`, name] : [v, name])}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#a0a0aa' }} />
        <Bar yAxisId="runs" dataKey="runs" name="Runs" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line yAxisId="wkts" dataKey="wickets" name="Wickets" stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 3, fill: '#60a5fa' }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function RatingTrendChart({ data }: { data: Rating[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 5" vertical={false} stroke="#25252b" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axis} interval="preserveStartEnd" minTickGap={14} />
        <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} axisLine={false} tickLine={false} tick={axis} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#a0a0aa' }} />
        <Line dataKey="average" name="Average" stroke="#f4f4f5" strokeWidth={3} dot={{ r: 3 }} />
        <Line dataKey="batting" name="Batting" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeOpacity={0.8} />
        <Line dataKey="bowling" name="Bowling" stroke="#60a5fa" strokeWidth={1.5} dot={false} strokeOpacity={0.8} />
        <Line dataKey="fielding" name="Fielding" stroke="#4ade80" strokeWidth={1.5} dot={false} strokeOpacity={0.8} />
        <Line dataKey="fitness" name="Fitness" stroke="#fbbf24" strokeWidth={1.5} dot={false} strokeOpacity={0.8} />
      </LineChart>
    </ResponsiveContainer>
  );
}
