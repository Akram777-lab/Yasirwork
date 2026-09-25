"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { useApp } from "@/components/app-shell";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { apiGet, apiSend, type CategoryRow } from "@/lib/client";
import { categorySchema } from "@/lib/validation";

type FormIn = z.input<typeof categorySchema>;
type FormValues = z.output<typeof categorySchema>;

const TYPE_TONE: Record<string, string> = { expense: "red", income: "green", work: "blue" };
const SWATCHES = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#64748b"];

export default function CategoriesPage() {
  const { user } = useApp();
  const isAdmin = user.role === "admin";
  const [items, setItems] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet<{ items: CategoryRow[] }>(`/api/categories?type=${typeFilter}`);
      setItems(d.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const form = useForm<FormIn, unknown, FormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", type: "expense", color: "#4f46e5", description: "", isActive: true },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ name: "", type: "expense", color: "#4f46e5", description: "", isActive: true });
    setOpen(true);
  }

  function openEdit(c: CategoryRow) {
    setEditing(c);
    form.reset({
      name: c.name,
      type: c.type as "expense" | "income" | "work",
      color: c.color,
      description: c.description ?? "",
      isActive: c.isActive,
    });
    setOpen(true);
  }

  async function onSubmit(values: FormValues) {
    try {
      if (editing) await apiSend(`/api/categories/${editing.id}`, "PATCH", values);
      else await apiSend("/api/categories", "POST", values);
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function remove(c: CategoryRow) {
    if (!confirm(`Delete category "${c.name}"? Linked records keep their data but lose the category.`)) return;
    try {
      await apiSend(`/api/categories/${c.id}`, "DELETE");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Organise expenses, income and daily work into meaningful buckets."
        action={
          <>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-40">
              <option value="all">All types</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="work">Work</option>
            </Select>
            <Button onClick={openCreate}><Plus size={16} /> New category</Button>
          </>
        }
      />

      {error ? <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p> : null}

      {loading ? (
        <Card><Spinner /></Card>
      ) : items.length === 0 ? (
        <Card><EmptyState title="No categories" message="Create categories to classify your records." icon={<Tags size={30} />} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-9 w-9 rounded-xl" style={{ background: c.color }} />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone={TYPE_TONE[c.type]}>{c.type}</Badge>
                      {!c.isActive ? <Badge tone="slate">archived</Badge> : null}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil size={15} /></Button>
                  {isAdmin ? (
                    <Button size="sm" variant="ghost" onClick={() => remove(c)}><Trash2 size={15} className="text-rose-600" /></Button>
                  ) : null}
                </div>
              </div>
              {c.description ? <p className="mt-3 text-xs text-slate-500">{c.description}</p> : null}
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit category" : "New category"}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input placeholder="e.g. Marketing" {...form.register("name")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select {...form.register("type")}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="work">Work</option>
              </Select>
            </Field>
            <Field label="Colour">
              <div className="flex items-center gap-2">
                <Input type="color" className="h-10 w-16 p-1" {...form.register("color")} />
                <div className="flex flex-wrap gap-1">
                  {SWATCHES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => form.setValue("color", s)}
                      className="h-5 w-5 rounded-full ring-1 ring-slate-200"
                      style={{ background: s }}
                      aria-label={s}
                    />
                  ))}
                </div>
              </div>
            </Field>
          </div>
          <Field label="Description">
            <Textarea placeholder="Optional" {...form.register("description")} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...form.register("isActive")} />
            Active (available when creating records)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{editing ? "Save changes" : "Create category"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
