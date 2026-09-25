import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, logActivity, verifyPassword } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = loginSchema.parse(body);
    const email = data.email.toLowerCase().trim();

    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    if (!user || !verifyPassword(data.password, user.passwordHash)) {
      return ok({ error: "Invalid email or password" }, 401);
    }
    if (!user.isActive) {
      return ok({ error: "Your account has been deactivated. Contact an administrator." }, 403);
    }

    await createSession(user.id);
    await logActivity(user.id, "login", "user", user.id, `${user.name} signed in`);
    return ok({ id: user.id, role: user.role });
  } catch (error) {
    return fail(error);
  }
}
