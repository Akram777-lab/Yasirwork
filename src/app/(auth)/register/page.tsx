"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Wallet } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { registerSchema } from "@/lib/validation";

type FormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", jobTitle: "", department: "" },
  });

  async function onSubmit(values: FormValues) {
    setServerError("");
    const res = await fetch("/api/auth/register", {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      setServerError(data.error ?? "Unable to create account");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 text-white">
            <Wallet size={22} />
          </span>
          <div>
            <p className="text-lg font-semibold text-slate-900">Create your account</p>
            <p className="text-xs text-slate-500">WorkTrack · Expense & Daily Work Management</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Full name" error={errors.name?.message}>
            <Input placeholder="Jane Cooper" {...register("name")} />
          </Field>
          <Field label="Email address" error={errors.email?.message}>
            <Input type="email" placeholder="you@company.com" {...register("email")} />
          </Field>
          <Field label="Password" error={errors.password?.message} hint="Minimum 6 characters">
            <Input type="password" placeholder="••••••••" {...register("password")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title (optional)">
              <Input placeholder="Operations Lead" {...register("jobTitle")} />
            </Field>
            <Field label="Department (optional)">
              <Input placeholder="Finance" {...register("department")} />
            </Field>
          </div>
          {serverError ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">{serverError}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            <UserPlus size={16} />
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
