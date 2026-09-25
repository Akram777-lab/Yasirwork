"use client";

import { CategoryPie, TrendChart } from "@/components/charts";
import { useApp } from "@/components/app-shell";
import { EmptyState } from "@/components/ui";
import { PieChart } from "lucide-react";

export function DashboardTrend({ data }: { data: { month: string; income: number; expense: number }[] }) {
  const { money } = useApp();
  if (!data.length) {
    return <EmptyState title="No financial data yet" message="Record your first expense or income to see the trend." icon={<PieChart size={28} />} />;
  }
  return <TrendChart data={data} money={(v) => money(v)} />;
}

export function DashboardCategories({ data }: { data: { name: string; color: string; total: number }[] }) {
  const { money } = useApp();
  if (!data.length) {
    return <EmptyState title="No expenses this month" message="Categorised spending will appear here." icon={<PieChart size={28} />} />;
  }
  return <CategoryPie data={data} money={(v) => money(v)} />;
}

export function Money({ value }: { value: number | string }) {
  const { money } = useApp();
  return <>{money(value)}</>;
}
