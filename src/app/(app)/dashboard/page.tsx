import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  ListChecks,
  Wallet,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getDashboardData } from "@/lib/dashboard";
import { Badge, Card, CardHeader, EmptyState, StatCard } from "@/components/ui";
import { DashboardCategories, DashboardTrend } from "@/components/dashboard-charts";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = { approved: "green", pending: "amber", rejected: "red" };
const PRIORITY_TONE: Record<string, string> = { low: "slate", medium: "blue", high: "amber", urgent: "red" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const settings = await getSettings();
  const data = await getDashboardData(user);
  const money = (v: number | string) => formatMoney(v, settings.currency, settings.locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back, {user.name.split(" ")[0]} 👋</h1>
        <p className="mt-1 text-sm text-slate-500">
          Here is your {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} overview
          {user.role === "employee" ? " (your records)" : " (whole organisation)"}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Income this month" value={money(data.totals.income)} tone="emerald" icon={<ArrowUpRight size={18} />} hint="Approved + pending" />
        <StatCard label="Expenses this month" value={money(data.totals.expense)} tone="rose" icon={<ArrowDownRight size={18} />} hint={`${data.totals.pending} pending approval`} />
        <StatCard label="Net balance" value={money(data.totals.net)} tone="indigo" icon={<Wallet size={18} />} hint="Income − expenses" />
        <StatCard label="Hours logged" value={`${data.totals.hours.toFixed(1)} h`} tone="sky" icon={<Clock size={18} />} hint={`${data.totals.entries} work entries`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Open tasks" value={String(data.totals.openTasks)} tone="amber" icon={<ListChecks size={18} />} />
        <StatCard label="Overdue tasks" value={String(data.totals.overdueTasks)} tone="rose" icon={<AlertTriangle size={18} />} />
        <StatCard label="Completed tasks" value={String(data.totals.doneTasks)} tone="emerald" icon={<ListChecks size={18} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Income vs expenses" subtitle="Last 6 months" />
          <div className="p-4">
            <DashboardTrend data={data.trend} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Spending by category" subtitle="Current month" />
          <div className="p-4">
            <DashboardCategories data={data.byCategory} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent transactions"
            action={<Link href="/expenses" className="text-xs font-medium text-indigo-600 hover:underline">View all</Link>}
          />
          {data.recentTransactions.length === 0 ? (
            <EmptyState title="No transactions yet" message="Add your first expense or income record." icon={<Wallet size={28} />} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentTransactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{t.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {formatDate(t.txnDate)} · {t.categoryName ?? "Uncategorized"} · {t.userName}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
                    <span className={t.type === "income" ? "text-sm font-semibold text-emerald-600" : "text-sm font-semibold text-rose-600"}>
                      {t.type === "income" ? "+" : "−"}
                      {money(t.amount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Upcoming tasks & follow-ups"
            action={<Link href="/tasks" className="text-xs font-medium text-indigo-600 hover:underline">View board</Link>}
          />
          {data.upcomingTasks.length === 0 ? (
            <EmptyState title="Nothing pending" message="All tasks are complete. Nice work!" icon={<ListChecks size={28} />} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.upcomingTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{t.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      Due {formatDate(t.dueDate)} · {t.assigneeName ?? "Unassigned"}
                      {t.followUpDate ? ` · follow-up ${formatDate(t.followUpDate)}` : ""}
                    </p>
                  </div>
                  <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Latest work logs"
            action={<Link href="/work-logs" className="text-xs font-medium text-indigo-600 hover:underline">View all</Link>}
          />
          {data.recentWork.length === 0 ? (
            <EmptyState title="No work logged" message="Capture what you worked on today." icon={<Clock size={28} />} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentWork.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{w.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {formatDate(w.logDate)} · {w.project ?? "General"} · {w.userName}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-700">{Number(w.hours).toFixed(1)} h</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={user.role === "employee" ? "My recent activity" : "Team activity"} action={<Link href="/activity" className="text-xs font-medium text-indigo-600 hover:underline">View log</Link>} />
          {data.activity.length === 0 ? (
            <EmptyState title="No activity recorded" icon={<Activity size={28} />} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-700">{a.detail}</p>
                    <p className="text-xs text-slate-400">
                      {a.userName ?? "System"} · {formatDateTime(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {data.topSpenders.length > 0 ? (
        <Card>
          <CardHeader title="Top spenders this month" subtitle="Expense totals per team member" />
          <div className="space-y-3 p-5">
            {data.topSpenders.map((s) => {
              const max = data.topSpenders[0].total || 1;
              return (
                <div key={s.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{s.name}</span>
                    <span className="text-slate-500">{money(s.total)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.max(4, (s.total / max) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
