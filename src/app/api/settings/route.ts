import { ok, fail } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getSettings, saveSettings, type AppSettings } from "@/lib/settings";
import { logActivity } from "@/lib/auth";

export async function GET() {
  try {
    const settings = await getSettings();
    return ok(settings);
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const body = (await request.json()) as Partial<AppSettings>;
    await saveSettings(body);
    await logActivity(admin.id, "update", "settings", null, "Updated application settings");
    return ok(await getSettings());
  } catch (error) {
    return fail(error);
  }
}
