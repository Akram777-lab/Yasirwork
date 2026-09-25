import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, logActivity, requireRole, requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { userSchema } from "@/lib/validation";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  try {
    // any signed-in user can read the directory (needed for assignment dropdowns)
    await requireUser();
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        jobTitle: users.jobTitle,
        department: users.department,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.name));
    return ok({ items: rows });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireRole(["admin"]);
    const data = userSchema.parse(await request.json());
    const email = data.email.toLowerCase().trim();
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) return ok({ error: "Email already in use" }, 409);
    if (!data.password) return ok({ error: "Password is required for new users" }, 422);

    const [created] = await db
      .insert(users)
      .values({
        name: data.name,
        email,
        passwordHash: hashPassword(data.password),
        role: data.role,
        jobTitle: data.jobTitle || null,
        department: data.department || null,
        isActive: data.isActive ?? true,
      })
      .returning({ id: users.id, name: users.name });
    await logActivity(admin.id, "create", "user", created.id, `Created user "${created.name}"`);
    return ok(created, 201);
  } catch (error) {
    return fail(error);
  }
}
