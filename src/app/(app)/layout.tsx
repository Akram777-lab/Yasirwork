import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const settings = await getSettings();
  return (
    <AppShell user={user} settings={settings}>
      {children}
    </AppShell>
  );
}
