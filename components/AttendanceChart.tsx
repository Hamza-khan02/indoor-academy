'use client';

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function AttendanceChart({ data, target }: { data: { label: string; pct: number | null; detail: string }[]; target: number }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="attFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 5" vertical={false} stroke="#25252b" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#777781', fontSize: 11 }} dy={10} interval="preserveStartEnd" minTickGap={12} />
        <YAxis domain={[0, 100]} hide />
        <ReferenceLine y={target} stroke="#4ade80" strokeDasharray="3 4" strokeOpacity={0.5} />
        <Tooltip
          contentStyle={{ background: '#18181d', border: '1px solid #303039', borderRadius: 10, color: '#fff', fontSize: 12 }}
          formatter={(v: number, _n, item: any) => [`${v}% (${item.payload.detail})`, 'Attendance']}
        />
        <Area type="monotone" dataKey="pct" stroke="#ef4444" strokeWidth={2.5} fill="url(#attFill)" dot={{ r: 3, fill: '#ef4444', stroke: '#17171b', strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
