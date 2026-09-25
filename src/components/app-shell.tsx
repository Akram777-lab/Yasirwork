"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  NotebookPen,
  ListChecks,
  BarChart3,
  Users,
  Tags,
  Settings as SettingsIcon,
  History,
  Menu,
  X,
  Wallet,
} from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";
import type { AppSettings } from "@/lib/settings";

type Ctx = { user: SessionUser; settings: AppSettings; money: (v: number | string) => string };
const AppContext = createContext<Ctx | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppShell");
  return ctx;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "employee"] },
  { href: "/expenses", label: "Expenses & Income", icon: Receipt, roles: ["admin", "manager", "employee"] },
  { href: "/work-logs", label: "Daily Work", icon: NotebookPen, roles: ["admin", "manager", "employee"] },
  { href: "/tasks", label: "Tasks & Follow-ups", icon: ListChecks, roles: ["admin", "manager", "employee"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager", "employee"] },
  { href: "/users", label: "Users & Access", icon: Users, roles: ["admin"] },
  { href: "/categories", label: "Categories", icon: Tags, roles: ["admin", "manager"] },
  { href: "/activity", label: "Activity Log", icon: History, roles: ["admin", "manager", "employee"] },
  { href: "/settings", label: "Settings", icon: SettingsIcon, roles: ["admin", "manager", "employee"] },
];

const ROLE_TONE: Record<string, string> = {
  admin: "bg-indigo-100 text-indigo-700",
  manager: "bg-sky-100 text-sky-700",
  employee: "bg-slate-100 text-slate-600",
};

export function AppShell({
  user,
  settings,
  children,
}: {
  user: SessionUser;
  settings: AppSettings;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const money = (v: number | string) => formatMoney(v, settings.currency, settings.locale);
  const items = NAV.filter((n) => n.roles.includes(user.role));

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white">
          <Wallet size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{settings.appName}</p>
          <p className="truncate text-[11px] text-slate-400">{settings.appSubtitle}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-indigo-600 text-white" : "hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-200">
            {user.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <span className={cn("mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", ROLE_TONE[user.role])}>
              {user.role}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <AppContext.Provider value={{ user, settings, money }}>
      <div className="min-h-screen bg-slate-100">
        <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>

        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
          </div>
        ) : null}

        <div className="lg:pl-64">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setOpen((v) => !v)}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden"
                aria-label="Toggle navigation"
              >
                {open ? <X size={18} /> : <Menu size={18} />}
              </button>
              <div>
                <p className="text-sm font-semibold text-slate-900">{settings.companyName}</p>
                <p className="text-[11px] text-slate-500">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
            </div>
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">Currency: {settings.currency}</span>
            </div>
          </header>
          <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </AppContext.Provider>
  );
}
