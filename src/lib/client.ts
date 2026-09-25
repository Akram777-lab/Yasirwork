"use client";

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Request failed");
  return data as T;
}

export async function apiSend<T>(url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error ?? "Request failed");
  return data as T;
}

export type CategoryRow = {
  id: number;
  name: string;
  type: string;
  color: string;
  description: string | null;
  isActive: boolean;
};

export type UserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  jobTitle: string | null;
  department: string | null;
  isActive: boolean;
  createdAt: string;
};
