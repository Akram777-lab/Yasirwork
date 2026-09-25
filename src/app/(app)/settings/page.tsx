"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Settings as SettingsIcon, ShieldAlert, Database } from "lucide-react";
import { useApp } from "@/components/app-shell";
import { Button, Card, CardHeader, Field, Input, PageHeader, Select } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/client";

type SettingsShape = {
  appName: string;
  appSubtitle: string;
  currency: string;
  locale: string;
  companyName: string;
  fiscalStartMonth: string;
  requireApproval: string;
};

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "INR", "PKR", "NGN", "KES", "ZAR", "AUD", "CAD", "JPY", "BDT", "EGP"];
const LOCALES = ["en-US", "en-GB", "de-DE", "fr-FR", "ar-AE", "hi-IN", "ur-PK", "ja-JP"];

export default function SettingsPage() {
  const { user } = useApp();
  const router = useRouter();
  const isAdmin = user.role === "admin";
  const [values, setValues] = useState<SettingsShape | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiGet<SettingsShape>("/api/settings").then(setValues).catch(() => {});
  }, []);

  async function save() {
    if (!values) return;
    setSaving(true);
    setMessage("");
    try {
      await apiSend("/api/settings", "PUT", values);
      setMessage("Settings saved successfully.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof SettingsShape, v: string) => setValues((prev) => (prev ? { ...prev, [k]: v } : prev));

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Rename the application, switch currency and control workspace behaviour."
        action={isAdmin ? <Button onClick={save} disabled={saving || !values}><Save size={16} /> {saving ? "Saving…" : "Save changes"}</Button> : undefined}
      />

      {!isAdmin ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <p>You can view workspace settings, but only administrators can change them.</p>
        </div>
      ) : null}

      {message ? <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">{message}</p> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Branding" subtitle="The application name shown across the interface" />
          <div className="grid gap-4 p-5">
            <Field label="Application name">
              <Input disabled={!isAdmin} value={values?.appName ?? ""} onChange={(e) => set("appName", e.target.value)} />
            </Field>
            <Field label="Subtitle">
              <Input disabled={!isAdmin} value={values?.appSubtitle ?? ""} onChange={(e) => set("appSubtitle", e.target.value)} />
            </Field>
            <Field label="Company / organisation name">
              <Input disabled={!isAdmin} value={values?.companyName ?? ""} onChange={(e) => set("companyName", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Regional & financial" subtitle="Currency and number formatting" />
          <div className="grid gap-4 p-5">
            <Field label="Currency">
              <Select disabled={!isAdmin} value={values?.currency ?? "USD"} onChange={(e) => set("currency", e.target.value)}>
                {CURRENCIES.map((c) => (<option key={c} value={c}>{c}</option>))}
              </Select>
            </Field>
            <Field label="Locale / number format">
              <Select disabled={!isAdmin} value={values?.locale ?? "en-US"} onChange={(e) => set("locale", e.target.value)}>
                {LOCALES.map((l) => (<option key={l} value={l}>{l}</option>))}
              </Select>
            </Field>
            <Field label="Fiscal year starts in month">
              <Select disabled={!isAdmin} value={values?.fiscalStartMonth ?? "1"} onChange={(e) => set("fiscalStartMonth", e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    {new Date(2024, i, 1).toLocaleDateString("en-US", { month: "long" })}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Expense approval workflow">
              <Select disabled={!isAdmin} value={values?.requireApproval ?? "true"} onChange={(e) => set("requireApproval", e.target.value)}>
                <option value="true">Employee submissions need manager approval</option>
                <option value="false">Auto-approve all submissions</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Your profile" subtitle="Account details for the signed in user" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Name"><Input disabled value={user.name} /></Field>
            <Field label="Email"><Input disabled value={user.email} /></Field>
            <Field label="Role"><Input disabled value={user.role} /></Field>
            <Field label="Department"><Input disabled value={user.department ?? "—"} /></Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="System" subtitle="Deployment information" />
          <div className="space-y-3 p-5 text-sm text-slate-600">
            <p className="flex items-center gap-2"><Database size={16} className="text-indigo-500" /> PostgreSQL database via Drizzle ORM data-access layer.</p>
            <p className="flex items-center gap-2"><SettingsIcon size={16} className="text-indigo-500" /> Connection is controlled by the <code className="rounded bg-slate-100 px-1">DATABASE_URL</code> environment variable, so the app can be pointed at any managed PostgreSQL instance in production.</p>
            <p className="flex items-center gap-2"><ShieldAlert size={16} className="text-indigo-500" /> Passwords are hashed with scrypt and sessions use httpOnly cookies.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
