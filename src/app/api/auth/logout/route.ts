import { destroySession, getCurrentUser, logActivity } from "@/lib/auth";
import { ok, fail } from "@/lib/api";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (user) await logActivity(user.id, "logout", "user", user.id, `${user.name} signed out`);
    await destroySession();
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
