"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Search, Pencil, Trash2, ListChecks, LayoutGrid, Rows3, Download, RotateCcw, CalendarClock } from "lucide-react";
import { useApp } from "@/components/app-shell";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Textarea } from "@/components/ui";
import { apiGet, apiSend, type UserRow } from "@/lib/client";
import { taskSchema } from "@/lib/validation";
import { downloadCSV, formatDate, toCSV, todayISO } from "@/lib/utils";

type Task = {
  id: number;
  title: string;
  description: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  createdByName: string | null;
  dueDate: string | null;
  followUpDate: string | null;
  priority: string;
  status: string;
};

type FormIn = z.input<typeof taskSchema>;
type FormValues = z.output<typeof taskSchema>;

const COLUMNS = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];
const PRIORITY_TONE: Record<string, string> = { low: "slate", medium: "blue", high: "amber", urgent: "red" };
const STATUS_TONE: Record<string, string> = { todo: "slate", in_progress: "blue", blocked: "red", done: "green" };

export default function TasksPage() {
  const { user } = useApp();
  const [items, setItems] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"board" | "list">("board");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filters, setFilters] = useState({ q: "", status: "all", priority: "all", assigneeId: "all" });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && v !== "all" && p.set(k, v));
    return p.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ items: Task[] }>(`/api/tasks?${query}`);
      setItems(data.items);
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
    apiGet<{ items: UserRow[] }>("/api/users").then((d) => setUsers(d.items)).catch(() => {});
  }, []);

  const form = useForm<FormIn, unknown, FormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", description: "", assigneeId: null, dueDate: "", followUpDate: "", priority: "medium", status: "todo" },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ title: "", description: "", assigneeId: user.id, dueDate: todayISO(), followUpDate: "", priority: "medium", status: "todo" });
    setOpen(true);
  }

  function openEdit(t: Task) {
    setEditing(t);
    form.reset({
      title: t.title,
      description: t.description ?? "",
      assigneeId: t.assigneeId,
      dueDate: t.dueDate ?? "",
      followUpDate: t.followUpDate ?? "",
      priority: t.priority as "low" | "medium" | "high" | "urgent",
      status: t.status as "todo" | "in_progress" | "blocked" | "done",
    });
    setOpen(true);
  }

  async function onSubmit(values: FormValues) {
    const payload = { ...values, assigneeId: values.assigneeId ? Number(values.assigneeId) : null };
    try {
      if (editing) await apiSend(`/api/tasks/${editing.id}`, "PATCH", payload);
      else await apiSend("/api/tasks", "POST", payload);
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function move(t: Task, status: string) {
    setItems((prev) => prev.map((i) => (i.id === t.id ? { ...i, status } : i)));
    await apiSend(`/api/tasks/${t.id}`, "PATCH", { status }).catch(() => {});
    await load();
  }

  async function remove(t: Task) {
    if (!confirm(`Delete task "${t.title}"?`)) return;
    await apiSend(`/api/tasks/${t.id}`, "DELETE").catch(() => {});
    await load();
  }

  function exportCSV() {
    const rows = items.map((t) => ({
      Title: t.title,
      Status: t.status,
      Priority: t.priority,
      Assignee: t.assigneeName ?? "",
      Due: t.dueDate ?? "",
      FollowUp: t.followUpDate ?? "",
      CreatedBy: t.createdByName ?? "",
      Description: t.description ?? "",
    }));
    downloadCSV(`worktrack-tasks-${todayISO()}.csv`, toCSV(rows));
  }

  const stats = useMemo(() => {
    const today = todayISO();
    return {
      open: items.filter((i) => i.status !== "done").length,
      overdue: items.filter((i) => i.status !== "done" && i.dueDate && i.dueDate < today).length,
      followUps: items.filter((i) => i.followUpDate && i.status !== "done").length,
      done: items.filter((i) => i.status === "done").length,
    };
  }, [items]);

  const TaskCard = ({ t }: { t: Task }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{t.title}</p>
        <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
      </div>
      {t.description ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{t.description}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span>{t.assigneeName ?? "Unassigned"}</span>
        {t.dueDate ? <span className={t.status !== "done" && t.dueDate < todayISO() ? "font-medium text-rose-600" : ""}>Due {formatDate(t.dueDate)}</span> : null}
        {t.followUpDate ? <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> {formatDate(t.followUpDate)}</span> : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Select className="h-8 py-1 text-xs" value={t.status} onChange={(e) => move(t, e.target.value)}>
          {COLUMNS.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </Select>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => openEdit(t)} title="Edit"><Pencil size={14} /></Button>
          <Button size="sm" variant="ghost" onClick={() => remove(t)} title="Delete"><Trash2 size={14} className="text-rose-600" /></Button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Tasks & Follow-ups"
        subtitle="Plan work, assign owners, set follow-up dates and never lose a thread."
        action={
          <>
            <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
              <button onClick={() => setView("board")} className={`px-3 py-2 text-xs font-medium ${view === "board" ? "bg-indigo-600 text-white" : "text-slate-600"}`}>
                <LayoutGrid size={14} className="inline" /> Board
              </button>
              <button onClick={() => setView("list")} className={`px-3 py-2 text-xs font-medium ${view === "list" ? "bg-indigo-600 text-white" : "text-slate-600"}`}>
                <Rows3 size={14} className="inline" /> List
              </button>
            </div>
            <Button variant="outline" onClick={exportCSV} disabled={items.length === 0}>
              <Download size={16} /> Export
            </Button>
            <Button onClick={openCreate}><Plus size={16} /> New task</Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open tasks" value={String(stats.open)} tone="indigo" icon={<ListChecks size={18} />} />
        <StatCard label="Overdue" value={String(stats.overdue)} tone="rose" icon={<ListChecks size={18} />} />
        <StatCard label="Follow-ups scheduled" value={String(stats.followUps)} tone="amber" icon={<CalendarClock size={18} />} />
        <StatCard label="Completed" value={String(stats.done)} tone="emerald" icon={<ListChecks size={18} />} />
      </div>

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search tasks…" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          </div>
          <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="all">All statuses</option>
            {COLUMNS.map((c) => (<option key={c.key} value={c.key}>{c.label}</option>))}
          </Select>
          <Select value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}>
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
          <div className="flex gap-2">
            <Select value={filters.assigneeId} onChange={(e) => setFilters((f) => ({ ...f, assigneeId: e.target.value }))}>
              <option value="all">Anyone</option>
              {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
            </Select>
            <Button variant="ghost" onClick={() => setFilters({ q: "", status: "all", priority: "all", assigneeId: "all" })}><RotateCcw size={15} /></Button>
          </div>
        </div>
      </Card>

      {error ? <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p> : null}

      {loading ? (
        <Card><Spinner /></Card>
      ) : items.length === 0 ? (
        <Card><EmptyState title="No tasks yet" message="Create your first task or follow-up." icon={<ListChecks size={30} />} /></Card>
      ) : view === "board" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const colItems = items.filter((i) => i.status === col.key);
            return (
              <div key={col.key} className="rounded-2xl bg-slate-200/50 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="text-sm font-semibold text-slate-700">{col.label}</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{colItems.length}</span>
                </div>
                <div className="space-y-3">
                  {colItems.map((t) => (<TaskCard key={t.id} t={t} />))}
                  {colItems.length === 0 ? <p className="px-1 py-6 text-center text-xs text-slate-400">Nothing here</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Task</th>
                  <th className="px-5 py-3 font-medium">Assignee</th>
                  <th className="px-5 py-3 font-medium">Due</th>
                  <th className="px-5 py-3 font-medium">Follow-up</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{t.title}</p>
                      {t.description ? <p className="line-clamp-1 text-xs text-slate-500">{t.description}</p> : null}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{t.assigneeName ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(t.dueDate)}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(t.followUpDate)}</td>
                    <td className="px-5 py-3"><Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge></td>
                    <td className="px-5 py-3"><Badge tone={STATUS_TONE[t.status]}>{t.status.replace("_", " ")}</Badge></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(t)}><Pencil size={15} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(t)}><Trash2 size={15} className="text-rose-600" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit task" : "New task"} wide>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Task title" error={form.formState.errors.title?.message}>
            <Input placeholder="e.g. Follow up with supplier about invoice" {...form.register("title")} />
          </Field>
          <Field label="Description">
            <Textarea placeholder="Context, links, expected outcome…" {...form.register("description")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Assignee">
              <Select {...form.register("assigneeId")}>
                <option value="">Unassigned</option>
                {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
              </Select>
            </Field>
            <Field label="Priority">
              <Select {...form.register("priority")}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Due date">
              <Input type="date" {...form.register("dueDate")} />
            </Field>
            <Field label="Follow-up date">
              <Input type="date" {...form.register("followUpDate")} />
            </Field>
            <Field label="Status">
              <Select {...form.register("status")}>
                {COLUMNS.map((c) => (<option key={c.key} value={c.key}>{c.label}</option>))}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{editing ? "Save changes" : "Create task"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
