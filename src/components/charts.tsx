"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { fontSize: 11, fill: "#64748b" } as const;

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function TrendChart({
  data,
  money,
}: {
  data: { month: string; income: number; expense: number }[];
  money: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data.map((d) => ({ ...d, label: monthLabel(d.month) }))} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => money(Number(v))} />
        <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #e2e8f0" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="income" name="Income" stroke="#10b981" fill="url(#inc)" strokeWidth={2} />
        <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" fill="url(#exp)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CategoryPie({
  data,
  money,
}: {
  data: { name: string; color: string; total: number }[];
  money: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="total" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #e2e8f0" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BarsChart({
  data,
  keys,
  money,
  xKey = "name",
}: {
  data: Record<string, string | number>[];
  keys: { key: string; label: string; color: string }[];
  money: (v: number) => string;
  xKey?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} interval={0} angle={-12} height={50} textAnchor="end" />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => money(Number(v))} />
        <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #e2e8f0" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k) => (
          <Bar key={k.key} dataKey={k.key} name={k.label} fill={k.color} radius={[6, 6, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
