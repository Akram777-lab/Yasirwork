"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  Plus,
  Search,
  Download,
  Pencil,
  Trash2,
  Check,
  X,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { useApp } from "@/components/app-shell";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, Textarea } from "@/components/ui";
import { apiGet, apiSend, type CategoryRow, type UserRow } from "@/lib/client";
import { transactionSchema } from "@/lib/validation";
import { downloadCSV, formatDate, monthStartISO, toCSV, todayISO } from "@/lib/utils";

type Txn = {
  id: number;
  type: string;
  title: string;
  amount: string;
  txnDate: string;
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  userId: number;
  userName: string | null;
  paymentMethod: string;
  vendor: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
};

type FormIn = z.input<typeof transactionSchema>;
type FormValues = z.output<typeof transactionSchema>;

const STATUS_TONE: Record<string, string> = { approved: "green", pending: "amber", rejected: "red" };
const PAYMENTS = ["cash", "card", "bank_transfer", "mobile_wallet", "cheque", "other"] as const;

export default function ExpensesPage() {
  const { user, money } = useApp();
  const canManage = user.role === "admin" || user.role === "manager";

  const [items, setItems] = useState<Txn[]>([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0, count: 0 });
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Txn | null>(null);

  const [filters, setFilters] = useState({
    q: "",
    type: "all",
    status: "all",
    categoryId: "all",
    userId: "all",
    from: monthStartISO(-2),
    to: "",
  });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== "all") p.set(k, v);
    });
    return p.toString();
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ items: Txn[]; totals: { income: number; expense: number; count: number } }>(
        `/api/transactions?${query}`,
      );
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
    apiGet<{ items: CategoryRow[] }>("/api/categories").then((d) => setCategories(d.items)).catch(() => {});
    apiGet<{ items: UserRow[] }>("/api/users").then((d) => setUsers(d.items)).catch(() => {});
  }, []);

  const form = useForm<FormIn, unknown, FormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "expense",
      title: "",
      amount: 0,
      txnDate: todayISO(),
      categoryId: null,
      paymentMethod: "cash",
      vendor: "",
      reference: "",
      notes: "",
      status: "approved",
    },
  });

  function openCreate() {
    setEditing(null);
    form.reset({
      type: "expense",
      title: "",
      amount: 0,
      txnDate: todayISO(),
      categoryId: null,
      paymentMethod: "cash",
      vendor: "",
      reference: "",
      notes: "",
      status: canManage ? "approved" : "pending",
      userId: user.id,
    });
    setOpen(true);
  }

  function openEdit(t: Txn) {
    setEditing(t);
    form.reset({
      type: t.type as "income" | "expense",
      title: t.title,
      amount: Number(t.amount),
      txnDate: t.txnDate,
      categoryId: t.categoryId,
      paymentMethod: t.paymentMethod as (typeof PAYMENTS)[number],
      vendor: t.vendor ?? "",
      reference: t.reference ?? "",
      notes: t.notes ?? "",
      status: t.status as "pending" | "approved" | "rejected",
      userId: t.userId,
    });
    setOpen(true);
  }

  async function onSubmit(values: FormValues) {
    const payload = { ...values, categoryId: values.categoryId ? Number(values.categoryId) : null };
    try {
      if (editing) await apiSend(`/api/transactions/${editing.id}`, "PATCH", payload);
      else await apiSend("/api/transactions", "POST", payload);
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function setStatus(t: Txn, status: string) {
    await apiSend(`/api/transactions/${t.id}`, "PATCH", { status }).catch(() => {});
    await load();
  }

  async function remove(t: Txn) {
    if (!confirm(`Delete "${t.title}"? This cannot be undone.`)) return;
    await apiSend(`/api/transactions/${t.id}`, "DELETE").catch(() => {});
    await load();
  }

  function exportCSV() {
    const rows = items.map((t) => ({
      Date: t.txnDate,
      Type: t.type,
      Title: t.title,
      Amount: t.amount,
      Category: t.categoryName ?? "",
      Member: t.userName ?? "",
      Payment: t.paymentMethod,
      Vendor: t.vendor ?? "",
      Reference: t.reference ?? "",
      Status: t.status,
      Notes: t.notes ?? "",
    }));
    downloadCSV(`worktrack-transactions-${todayISO()}.csv`, toCSV(rows));
  }

  const catOptions = categories.filter((c) => c.type === form.watch("type") || c.type === "expense" || c.type === "income");

  return (
    <div>
      <PageHeader
        title="Expenses & Income"
        subtitle="Record, search, approve and export every financial movement."
        action={
          <>
            <Button variant="outline" onClick={exportCSV} disabled={items.length === 0}>
              <Download size={16} /> Export CSV
            </Button>
            <Button onClick={openCreate}>
              <Plus size={16} /> New transaction
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total income" value={money(totals.income)} tone="emerald" icon={<Receipt size={18} />} />
        <StatCard label="Total expenses" value={money(totals.expense)} tone="rose" icon={<Receipt size={18} />} />
        <StatCard label="Net" value={money(totals.income - totals.expense)} tone="indigo" hint={`${totals.count} records match`} icon={<Receipt size={18} />} />
      </div>

      <Card className="mb-5">
        <div className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-7">
          <div className="relative xl:col-span-2">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search title, vendor, reference…"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
          <Select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
            <option value="all">All types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </Select>
          <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
          <Select value={filters.categoryId} onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}>
            <option value="all">All categories</option>
            {categories.filter((c) => c.type !== "work").map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          {canManage ? (
            <Select value={filters.userId} onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}>
              <option value="all">All members</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Button
            variant="ghost"
            onClick={() => setFilters({ q: "", type: "all", status: "all", categoryId: "all", userId: "all", from: "", to: "" })}
          >
            <RotateCcw size={15} /> Reset
          </Button>
        </div>
      </Card>

      {error ? <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p> : null}

      <Card>
        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState title="No transactions found" message="Adjust your filters or add a new record." icon={<Receipt size={30} />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-5 py-3 font-medium">Payment</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(t.txnDate)}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{t.title}</p>
                      {t.vendor ? <p className="text-xs text-slate-500">{t.vendor}</p> : null}
                    </td>
                    <td className="px-5 py-3">
                      {t.categoryName ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <span className="h-2 w-2 rounded-full" style={{ background: t.categoryColor ?? "#94a3b8" }} />
                          {t.categoryName}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{t.userName}</td>
                    <td className="px-5 py-3 text-slate-600">{t.paymentMethod.replace("_", " ")}</td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
                    </td>
                    <td className={`px-5 py-3 text-right font-semibold ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                      {t.type === "income" ? "+" : "−"}
                      {money(t.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canManage && t.status !== "approved" ? (
                          <Button size="sm" variant="ghost" title="Approve" onClick={() => setStatus(t, "approved")}>
                            <Check size={15} className="text-emerald-600" />
                          </Button>
                        ) : null}
                        {canManage && t.status !== "rejected" ? (
                          <Button size="sm" variant="ghost" title="Reject" onClick={() => setStatus(t, "rejected")}>
                            <X size={15} className="text-rose-600" />
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" title="Edit" onClick={() => openEdit(t)}>
                          <Pencil size={15} />
                        </Button>
                        <Button size="sm" variant="ghost" title="Delete" onClick={() => remove(t)}>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit transaction" : "New transaction"} wide>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" error={form.formState.errors.type?.message}>
              <Select {...form.register("type")}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </Select>
            </Field>
            <Field label="Date" error={form.formState.errors.txnDate?.message}>
              <Input type="date" {...form.register("txnDate")} />
            </Field>
          </div>
          <Field label="Title" error={form.formState.errors.title?.message}>
            <Input placeholder="e.g. Client lunch meeting" {...form.register("title")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" error={form.formState.errors.amount?.message}>
              <Input type="number" step="0.01" min="0" {...form.register("amount")} />
            </Field>
            <Field label="Category">
              <Select {...form.register("categoryId")}>
                <option value="">Uncategorized</option>
                {catOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment method">
              <Select {...form.register("paymentMethod")}>
                {PAYMENTS.map((p) => (
                  <option key={p} value={p}>
                    {p.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Vendor / payee">
              <Input placeholder="Vendor name" {...form.register("vendor")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reference / invoice no.">
              <Input placeholder="INV-00123" {...form.register("reference")} />
            </Field>
            {canManage ? (
              <Field label="Status">
                <Select {...form.register("status")}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </Select>
              </Field>
            ) : null}
          </div>
          {canManage ? (
            <Field label="Recorded for">
              <Select {...form.register("userId")}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Notes">
            <Textarea placeholder="Optional details…" {...form.register("notes")} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {editing ? "Save changes" : "Create transaction"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
