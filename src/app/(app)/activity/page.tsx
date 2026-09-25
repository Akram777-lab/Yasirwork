"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { History, Search, Download, RotateCcw } from "lucide-react";
import { useApp } from "@/components/app-shell";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { apiGet, type UserRow } from "@/lib/client";
import { downloadCSV, formatDateTime, toCSV, todayISO } from "@/lib/utils";

type ActivityRow = {
  id: number;
  userName: string | null;
  action: string;
  entity: string;
  entityId: number | null;
  detail: string | null;
  createdAt: string;
};

const ACTION_TONE: Record<string, string> = {
  create: "green",
  update: "blue",
  delete: "red",
  login: "indigo",
  logout: "slate",
  approved: "green",
  rejected: "red",
  register: "purple",
};

export default function ActivityPage() {
  const { user } = useApp();
  const canSeeAll = user.role === "admin" || user.role === "manager";
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: "", entity: "all", userId: "all" });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && v !== "all" && p.set(k, v));
    return p.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet<{ items: ActivityRow[] }>(`/api/activity?${query}`);
      setItems(d.items);
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

  function exportCSV() {
    downloadCSV(
      `worktrack-activity-${todayISO()}.csv`,
      toCSV(items.map((a) => ({ When: a.createdAt, User: a.userName ?? "", Action: a.action, Entity: a.entity, Detail: a.detail ?? "" }))),
    );
  }

  return (
    <div>
      <PageHeader
        title="Activity Log"
        subtitle={canSeeAll ? "Full audit trail of everything happening in the workspace." : "Your personal audit trail."}
        action={<Button variant="outline" onClick={exportCSV} disabled={items.length === 0}><Download size={16} /> Export</Button>}
      />

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search activity…" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          </div>
          <Select value={filters.entity} onChange={(e) => setFilters((f) => ({ ...f, entity: e.target.value }))}>
            <option value="all">All modules</option>
            <option value="transaction">Transactions</option>
            <option value="work_log">Work logs</option>
            <option value="task">Tasks</option>
            <option value="category">Categories</option>
            <option value="user">Users</option>
            <option value="settings">Settings</option>
          </Select>
          <div className="flex gap-2">
            {canSeeAll ? (
              <Select value={filters.userId} onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}>
                <option value="all">Everyone</option>
                {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
              </Select>
            ) : null}
            <Button variant="ghost" onClick={() => setFilters({ q: "", entity: "all", userId: "all" })}><RotateCcw size={15} /></Button>
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState title="No activity recorded" message="Actions performed in the app will show up here." icon={<History size={30} />} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex min-w-0 items-start gap-3">
                  <Badge tone={ACTION_TONE[a.action] ?? "slate"}>{a.action}</Badge>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-700">{a.detail}</p>
                    <p className="text-xs text-slate-400">
                      {a.userName ?? "System"} · {a.entity.replace("_", " ")}
                      {a.entityId ? ` #${a.entityId}` : ""}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
