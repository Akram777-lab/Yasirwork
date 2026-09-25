import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AUTH_DISABLED, getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AppShell } from "@/components/app-shell";
import { DEFAULT_SETTINGS } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser().catch(() => null);

  if (!user && !AUTH_DISABLED) {
    redirect("/login");
  }

  if (!user) {
    // AUTH_DISABLED is true but DB is unreachable — show a setup-required page.
    return (
      <html lang="en">
        <body style={{ fontFamily: "system-ui", padding: "3rem", textAlign: "center" }}>
          <h1>⚠️ Database not connected</h1>
          <p>
            The app is running in open-access mode but cannot reach the database.
          </p>
          <p>
            Make sure <code>DATABASE_URL</code> is set in <strong>Vercel → Settings → Environment Variables</strong>,
            then <strong>Redeploy</strong>.
          </p>
          <pre style={{ background: "#f5f5f5", padding: "1rem", borderRadius: "8px", display: "inline-block", textAlign: "left" }}>
            DATABASE_URL=postgresql://neondb_owner:...@ep-xxx.neon.tech/neondb?sslmode=require{"\n"}
            AUTH_DISABLED=true
          </pre>
        </body>
      </html>
    );
  }

  const settings = await getSettings().catch(() => DEFAULT_SETTINGS);
  return (
    <AppShell user={user} settings={settings}>
      {children}
    </AppShell>
  );
}
