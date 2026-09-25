import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { sql } from "drizzle-orm";

export type AppSettings = {
  appName: string;
  appSubtitle: string;
  currency: string;
  locale: string;
  fiscalStartMonth: string;
  companyName: string;
  requireApproval: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  appName: "WorkTrack",
  appSubtitle: "Expense & Daily Work Management System",
  currency: "USD",
  locale: "en-US",
  fiscalStartMonth: "1",
  companyName: "WorkTrack Inc.",
  requireApproval: "true",
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const rows = await db.select().from(appSettings);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { ...DEFAULT_SETTINGS, ...map } as AppSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(values: Partial<AppSettings>) {
  const entries = Object.entries(values).filter(([, v]) => typeof v === "string");
  for (const [key, value] of entries) {
    await db
      .insert(appSettings)
      .values({ key, value: value as string })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: value as string, updatedAt: sql`now()` },
      });
  }
}
