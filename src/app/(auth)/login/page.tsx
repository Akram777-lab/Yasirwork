"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Wallet, LogIn } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { loginSchema } from "@/lib/validation";

type FormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: FormValues) {
    setServerError("");
    const res = await fetch("/api/auth/login", {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      setServerError(data.error ?? "Unable to sign in");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600">
            <Wallet size={22} />
          </span>
          <div>
            <p className="text-lg font-semibold">WorkTrack</p>
            <p className="text-xs text-slate-400">Expense & Daily Work Management System</p>
          </div>
        </div>
        <div className="space-y-6">
          <h1 className="text-4xl font-semibold leading-tight">
            Every expense, task and work hour — <span className="text-indigo-400">in one place.</span>
          </h1>
          <ul className="space-y-3 text-sm text-slate-300">
            {[
              "Daily expense & income tracking with approvals",
              "Daily work logs and billable hours",
              "Tasks, follow-ups and priorities",
              "Dashboards, reports and CSV exports",
              "Role based access for your whole team",
            ].map((line) => (
              <li key={line} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500">Secure email & password authentication · PostgreSQL backed</p>
      </div>

      <div className="flex items-center justify-center bg-slate-100 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 text-white">
              <Wallet size={22} />
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to your WorkTrack workspace.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Field label="Email address" error={errors.email?.message}>
              <Input type="email" placeholder="you@company.com" autoComplete="email" {...register("email")} />
            </Field>
            <Field label="Password" error={errors.password?.message}>
              <Input type="password" placeholder="••••••••" autoComplete="current-password" {...register("password")} />
            </Field>
            {serverError ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">{serverError}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              <LogIn size={16} />
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            No account yet?{" "}
            <Link href="/register" className="font-medium text-indigo-600 hover:underline">
              Create one
            </Link>
          </p>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            The first registered account automatically becomes the administrator.
          </p>

          <div className="mt-6 rounded-xl bg-slate-50 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Demo accounts</p>
            <div className="space-y-1.5">
              {[
                { label: "Admin", email: "admin@worktrack.app", password: "admin123" },
                { label: "Manager", email: "manager@worktrack.app", password: "manager123" },
                { label: "Employee", email: "sara@worktrack.app", password: "employee123" },
              ].map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setValue("email", d.email);
                    setValue("password", d.password);
                  }}
                  className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200 transition hover:ring-indigo-300"
                >
                  <span className="font-medium text-slate-700">{d.label}</span>
                  <span className="text-slate-400">{d.email} · {d.password}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
