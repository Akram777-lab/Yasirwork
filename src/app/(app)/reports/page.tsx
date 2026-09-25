"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Download, RefreshCw } from "lucide-react";
import { useApp } from "@/components/app-shell";
import { BarsChart, CategoryPie, TrendChart } from "@/components/charts";
import { Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Spinner, StatCard } from "@/components/ui";
import { apiGet, type UserRow } from "@/lib/client";
import { downloadCSV, monthStartISO, toCSV, todayISO } from "@/lib/utils";

type ReportData = {
  range: { from: string; to: string };
  totals: { income: number; expense: number; net: number; pending: number; count: number; hours: number; entries: number };
  monthly: { month: string; income: number; expense: number; net: number }[];
  byCategory: { name: string; color: string; total: number }[];
  byUser: { name: string; expense: number; income: number; count: number }[];
  hoursByUser: { name: string; hours: number; entries: number }[];
  taskStats: { status: string; count: number }[];
};

export default function ReportsPage() {
  const { user, money } = useApp();
  const canSeeAll = user.role === "admin" || user.role === "manager";
  const [data, setData] = useState<ReportData | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: monthStartISO(-5), to: todayISO(), userId: "all" });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (range.from) p.set("from", range.from);
    if (range.to) p.set("to", range.to);
    if (range.userId !== "all") p.set("userId", range.userId);
    return p.toString();
  }, [range]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiGet<ReportData>(`/api/reports?${query}`));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (canSeeAll) apiGet<{ items: UserRow[] }>("/api/users").then((d) => setUsers(d.items)).catch(() => {});
  }, [canSeeAll]);

  function exportSummary() {
    if (!data) return;
    const rows = data.monthly.map((m) => ({ Month: m.month, Income: m.income, Expense: m.expense, Net: m.net }));
    downloadCSV(`worktrack-monthly-summary-${todayISO()}.csv`, toCSV(rows));
  }

  function exportCategories() {
    if (!data) return;
    downloadCSV(
      `worktrack-category-breakdown-${todayISO()}.csv`,
      toCSV(data.byCategory.map((c) => ({ Category: c.name, Total: c.total }))),
    );
  }

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Financial performance, team productivity and task throughput."
        action={
          <>
            <Button variant="outline" onClick={() => void load()}><RefreshCw size={16} /> Refresh</Button>
            <Button onClick={exportSummary} disabled={!data}><Download size={16} /> Export summary</Button>
          </>
        }
      />

      <Card className="mb-5">
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="From">
            <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          </Field>
          <Field label="To">
            <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </Field>
          {canSeeAll ? (
            <Field label="Team member">
              <Select value={range.userId} onChange={(e) => setRange((r) => ({ ...r, userId: e.target.value }))}>
                <option value="all">Whole organisation</option>
                {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
              </Select>
            </Field>
          ) : null}
          <Field label="Quick range">
            <Select
              defaultValue="6m"
              onChange={(e) => {
                const v = e.target.value;
                if (v === "1m") setRange((r) => ({ ...r, from: monthStartISO(), to: todayISO() }));
                if (v === "3m") setRange((r) => ({ ...r, from: monthStartISO(-2), to: todayISO() }));
                if (v === "6m") setRange((r) => ({ ...r, from: monthStartISO(-5), to: todayISO() }));
                if (v === "12m") setRange((r) => ({ ...r, from: monthStartISO(-11), to: todayISO() }));
              }}
            >
              <option value="1m">This month</option>
              <option value="3m">Last 3 months</option>
              <option value="6m">Last 6 months</option>
              <option value="12m">Last 12 months</option>
            </Select>
          </Field>
        </div>
      </Card>

      {loading || !data ? (
        <Card><Spinner label="Crunching numbers…" /></Card>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total income" value={money(data.totals.income)} tone="emerald" icon={<BarChart3 size={18} />} />
            <StatCard label="Total expenses" value={money(data.totals.expense)} tone="rose" icon={<BarChart3 size={18} />} />
            <StatCard label="Net result" value={money(data.totals.net)} tone="indigo" hint={`${data.totals.count} transactions`} icon={<BarChart3 size={18} />} />
            <StatCard label="Hours logged" value={`${data.totals.hours.toFixed(1)} h`} tone="sky" hint={`${data.totals.entries} work entries`} icon={<BarChart3 size={18} />} />
          </div>

          <Card>
            <CardHeader title="Monthly income vs expenses" subtitle={`${data.range.from} → ${data.range.to}`} />
            <div className="p-4">
              {data.monthly.length ? <TrendChart data={data.monthly} money={(v) => money(v)} /> : <EmptyState title="No data in this range" />}
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader
                title="Expenses by category"
                action={<button onClick={exportCategories} className="text-xs font-medium text-indigo-600 hover:underline">Export CSV</button>}
              />
              <div className="p-4">
                {data.byCategory.length ? <CategoryPie data={data.byCategory} money={(v) => money(v)} /> : <EmptyState title="No expenses in this range" />}
              </div>
            </Card>

            <Card>
              <CardHeader title="Spend & income per member" />
              <div className="p-4">
                {data.byUser.length ? (
                  <BarsChart
                    data={data.byUser as unknown as Record<string, string | number>[]}
                    keys={[
                      { key: "expense", label: "Expense", color: "#ef4444" },
                      { key: "income", label: "Income", color: "#10b981" },
                    ]}
                    money={(v) => money(v)}
                  />
                ) : (
                  <EmptyState title="No member data" />
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Hours logged per member" />
              {data.hoursByUser.length === 0 ? (
                <EmptyState title="No work logs in this range" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Member</th>
                        <th className="px-5 py-3 text-right font-medium">Entries</th>
                        <th className="px-5 py-3 text-right font-medium">Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.hoursByUser.map((h) => (
                        <tr key={h.name}>
                          <td className="px-5 py-3 text-slate-700">{h.name}</td>
                          <td className="px-5 py-3 text-right text-slate-600">{h.entries}</td>
                          <td className="px-5 py-3 text-right font-semibold text-slate-800">{h.hours.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Task pipeline" subtitle="All tasks by status" />
              <div className="space-y-3 p-5">
                {data.taskStats.length === 0 ? (
                  <EmptyState title="No tasks recorded" />
                ) : (
                  data.taskStats.map((t) => {
                    const max = Math.max(...data.taskStats.map((s) => s.count)) || 1;
                    return (
                      <div key={t.status}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium capitalize text-slate-700">{t.status.replace("_", " ")}</span>
                          <span className="text-slate-500">{t.count}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.max(4, (t.count / max) * 100)}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
