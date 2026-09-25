"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Search, Download, Pencil, Trash2, NotebookPen, Clock, RotateCcw, CalendarDays } from "lucide-react";
import { useApp } from "@/components/app-shell";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Textarea } from "@/components/ui";
import { apiGet, apiSend, type CategoryRow, type UserRow } from "@/lib/client";
import { workLogSchema } from "@/lib/validation";
import { downloadCSV, formatDate, monthStartISO, toCSV, todayISO } from "@/lib/utils";

type WorkLog = {
  id: number;
  userId: number;
  userName: string | null;
  logDate: string;
  title: string;
  description: string | null;
  project: string | null;
  hours: string;
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  status: string;
};

type FormIn = z.input<typeof workLogSchema>;
type FormValues = z.output<typeof workLogSchema>;

const STATUS_TONE: Record<string, string> = { completed: "green", in_progress: "blue", planned: "amber" };

export default function WorkLogsPage() {
  const { user } = useApp();
  const canManage = user.role === "admin" || user.role === "manager";

  const [items, setItems] = useState<WorkLog[]>([]);
  const [totals, setTotals] = useState({ hours: 0, count: 0 });
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkLog | null>(null);
  const [filters, setFilters] = useState({ q: "", status: "all", categoryId: "all", userId: "all", from: monthStartISO(), to: "" });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && v !== "all" && p.set(k, v));
    return p.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ items: WorkLog[]; totals: { hours: number; count: number } }>(`/api/work-logs?${query}`);
      setItems(data.items);
      setTotals(data.totals);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    apiGet<{ items: CategoryRow[] }>("/api/categories?type=work").then((d) => setCategories(d.items)).catch(() => {});
    apiGet<{ items: UserRow[] }>("/api/users").then((d) => setUsers(d.items)).catch(() => {});
  }, []);

  const form = useForm<FormIn, unknown, FormValues>({
    resolver: zodResolver(workLogSchema),
    defaultValues: { logDate: todayISO(), title: "", description: "", project: "", hours: 1, categoryId: null, status: "completed" },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ logDate: todayISO(), title: "", description: "", project: "", hours: 1, categoryId: null, status: "completed", userId: user.id });
    setOpen(true);
  }

  function openEdit(w: WorkLog) {
    setEditing(w);
    form.reset({
      logDate: w.logDate,
      title: w.title,
      description: w.description ?? "",
      project: w.project ?? "",
      hours: Number(w.hours),
      categoryId: w.categoryId,
      status: w.status as "planned" | "in_progress" | "completed",
      userId: w.userId,
    });
    setOpen(true);
  }

  async function onSubmit(values: FormValues) {
    const payload = { ...values, categoryId: values.categoryId ? Number(values.categoryId) : null };
    try {
      if (editing) await apiSend(`/api/work-logs/${editing.id}`, "PATCH", payload);
      else await apiSend("/api/work-logs", "POST", payload);
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function remove(w: WorkLog) {
    if (!confirm(`Delete work log "${w.title}"?`)) return;
    await apiSend(`/api/work-logs/${w.id}`, "DELETE").catch(() => {});
    await load();
  }

  function exportCSV() {
    const rows = items.map((w) => ({
      Date: w.logDate,
      Title: w.title,
      Project: w.project ?? "",
      Category: w.categoryName ?? "",
      Hours: w.hours,
      Member: w.userName ?? "",
      Status: w.status,
      Description: w.description ?? "",
    }));
    downloadCSV(`worktrack-work-logs-${todayISO()}.csv`, toCSV(rows));
  }

  const avgPerDay = useMemo(() => {
    const days = new Set(items.map((i) => i.logDate)).size || 1;
    return totals.hours / days;
  }, [items, totals.hours]);

  return (
    <div>
      <PageHeader
        title="Daily Work"
        subtitle="Log what you and your team worked on, every single day."
        action={
          <>
            <Button variant="outline" onClick={exportCSV} disabled={items.length === 0}>
              <Download size={16} /> Export CSV
            </Button>
            <Button onClick={openCreate}>
              <Plus size={16} /> Log work
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Hours logged" value={`${totals.hours.toFixed(1)} h`} tone="sky" icon={<Clock size={18} />} />
        <StatCard label="Work entries" value={String(totals.count)} tone="indigo" icon={<NotebookPen size={18} />} />
        <StatCard label="Average per active day" value={`${avgPerDay.toFixed(1)} h`} tone="emerald" icon={<CalendarDays size={18} />} />
      </div>

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search title, project, description…" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          </div>
          <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="all">All statuses</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </Select>
          <Select value={filters.categoryId} onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          {canManage ? (
            <Select value={filters.userId} onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}>
              <option value="all">All members</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          ) : null}
          <Button variant="ghost" onClick={() => setFilters({ q: "", status: "all", categoryId: "all", userId: "all", from: "", to: "" })}>
            <RotateCcw size={15} /> Reset
          </Button>
        </div>
      </Card>

      {error ? <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p> : null}

      <Card>
        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState title="No work logged" message="Start capturing your daily activities." icon={<NotebookPen size={30} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Activity</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Hours</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(w.logDate)}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{w.title}</p>
                      {w.description ? <p className="line-clamp-1 text-xs text-slate-500">{w.description}</p> : null}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{w.project ?? "—"}</td>
                    <td className="px-5 py-3">
                      {w.categoryName ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <span className="h-2 w-2 rounded-full" style={{ background: w.categoryColor ?? "#94a3b8" }} />
                          {w.categoryName}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{w.userName}</td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_TONE[w.status]}>{w.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-700">{Number(w.hours).toFixed(1)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(w)} title="Edit">
                          <Pencil size={15} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(w)} title="Delete">
                          <Trash2 size={15} className="text-rose-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit work log" : "Log daily work"} wide>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" error={form.formState.errors.logDate?.message}>
              <Input type="date" {...form.register("logDate")} />
            </Field>
            <Field label="Hours spent" error={form.formState.errors.hours?.message}>
              <Input type="number" step="0.25" min="0" max="24" {...form.register("hours")} />
            </Field>
          </div>
          <Field label="What did you work on?" error={form.formState.errors.title?.message}>
            <Input placeholder="e.g. Prepared quarterly budget report" {...form.register("title")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project / client">
              <Input placeholder="Project name" {...form.register("project")} />
            </Field>
            <Field label="Category">
              <Select {...form.register("categoryId")}>
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <Select {...form.register("status")}>
                <option value="planned">Planned</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </Select>
            </Field>
            {canManage ? (
              <Field label="Team member">
                <Select {...form.register("userId")}>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
          <Field label="Details">
            <Textarea placeholder="Notes, outcomes, blockers…" {...form.register("description")} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{editing ? "Save changes" : "Save work log"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
