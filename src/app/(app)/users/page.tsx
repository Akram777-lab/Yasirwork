"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Pencil, Trash2, Users, ShieldCheck, Search, Download } from "lucide-react";
import { useApp } from "@/components/app-shell";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard } from "@/components/ui";
import { apiGet, apiSend, type UserRow } from "@/lib/client";
import { userSchema } from "@/lib/validation";
import { downloadCSV, formatDate, toCSV, todayISO } from "@/lib/utils";

type FormIn = z.input<typeof userSchema>;
type FormValues = z.output<typeof userSchema>;

const ROLE_TONE: Record<string, string> = { admin: "indigo", manager: "blue", employee: "slate" };
const PERMISSIONS = [
  { role: "Admin", scope: "Full access: users, categories, settings, all records, approvals." },
  { role: "Manager", scope: "Sees all records, approves/rejects transactions, manages categories." },
  { role: "Employee", scope: "Creates and manages only their own expenses, work logs and tasks." },
];

export default function UsersPage() {
  const { user } = useApp();
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet<{ items: UserRow[] }>("/api/users");
      setItems(d.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const form = useForm<FormIn, unknown, FormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", password: "", role: "employee", jobTitle: "", department: "", isActive: true },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ name: "", email: "", password: "", role: "employee", jobTitle: "", department: "", isActive: true });
    setOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    form.reset({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role as "admin" | "manager" | "employee",
      jobTitle: u.jobTitle ?? "",
      department: u.department ?? "",
      isActive: u.isActive,
    });
    setOpen(true);
  }

  async function onSubmit(values: FormValues) {
    try {
      if (editing) await apiSend(`/api/users/${editing.id}`, "PATCH", values);
      else await apiSend("/api/users", "POST", values);
      setOpen(false);
      setError("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function remove(u: UserRow) {
    if (!confirm(`Delete ${u.name}? All of their records will be removed.`)) return;
    try {
      await apiSend(`/api/users/${u.id}`, "DELETE");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function toggleActive(u: UserRow) {
    await apiSend(`/api/users/${u.id}`, "PATCH", {
      name: u.name,
      email: u.email,
      role: u.role,
      jobTitle: u.jobTitle ?? "",
      department: u.department ?? "",
      isActive: !u.isActive,
    }).catch((e) => setError(e instanceof Error ? e.message : "Update failed"));
    await load();
  }

  const filtered = useMemo(
    () => items.filter((u) => `${u.name} ${u.email} ${u.department ?? ""} ${u.jobTitle ?? ""}`.toLowerCase().includes(q.toLowerCase())),
    [items, q],
  );

  function exportCSV() {
    downloadCSV(
      `worktrack-users-${todayISO()}.csv`,
      toCSV(filtered.map((u) => ({ Name: u.name, Email: u.email, Role: u.role, Title: u.jobTitle ?? "", Department: u.department ?? "", Active: u.isActive, Joined: u.createdAt }))),
    );
  }

  return (
    <div>
      <PageHeader
        title="Users & Access"
        subtitle="Invite team members, assign roles and control who can see what."
        action={
          <>
            <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}><Download size={16} /> Export</Button>
            <Button onClick={openCreate}><Plus size={16} /> New user</Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total members" value={String(items.length)} tone="indigo" icon={<Users size={18} />} />
        <StatCard label="Active" value={String(items.filter((u) => u.isActive).length)} tone="emerald" icon={<ShieldCheck size={18} />} />
        <StatCard label="Administrators" value={String(items.filter((u) => u.role === "admin").length)} tone="amber" icon={<ShieldCheck size={18} />} />
      </div>

      {error ? <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p> : null}

      <Card className="mb-5">
        <div className="relative p-4">
          <Search size={15} className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search by name, email, department…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>

      <Card className="mb-5">
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState title="No users found" icon={<Users size={30} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                          {u.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-medium text-slate-800">{u.name}{u.id === user.id ? " (you)" : ""}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><Badge tone={ROLE_TONE[u.role]}>{u.role}</Badge></td>
                    <td className="px-5 py-3 text-slate-600">{u.jobTitle ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{u.department ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(u.createdAt)}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => toggleActive(u)} className="cursor-pointer">
                        <Badge tone={u.isActive ? "green" : "slate"}>{u.isActive ? "active" : "disabled"}</Badge>
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(u)}><Pencil size={15} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(u)} disabled={u.id === user.id}>
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

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">Permission model</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {PERMISSIONS.map((p) => (
            <div key={p.role} className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">{p.role}</p>
              <p className="mt-1 text-xs text-slate-500">{p.scope}</p>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.name}` : "Create user"} wide>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} />
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register("email")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={editing ? "New password (leave blank to keep)" : "Password"} error={form.formState.errors.password?.message}>
              <Input type="password" placeholder="••••••••" {...form.register("password")} />
            </Field>
            <Field label="Role">
              <Select {...form.register("role")}>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title">
              <Input {...form.register("jobTitle")} />
            </Field>
            <Field label="Department">
              <Input {...form.register("department")} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...form.register("isActive")} />
            Account active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{editing ? "Save changes" : "Create user"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
