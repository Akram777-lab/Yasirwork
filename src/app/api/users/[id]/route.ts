import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, HttpError, logActivity, requireRole } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { userSchema } from "@/lib/validation";
import { eq } from "drizzle-orm";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const admin = await requireRole(["admin"]);
    const { id } = await params;
    const userId = Number(id);
    const data = userSchema.parse(await request.json());
    if (admin.id === userId && data.role !== "admin") {
      throw new HttpError(400, "You cannot remove your own admin role");
    }
    const [updated] = await db
      .update(users)
      .set({
        name: data.name,
        email: data.email.toLowerCase().trim(),
        role: data.role,
        jobTitle: data.jobTitle || null,
        department: data.department || null,
        isActive: data.isActive ?? true,
        ...(data.password ? { passwordHash: hashPassword(data.password) } : {}),
      })
      .where(eq(users.id, userId))
      .returning({ id: users.id, name: users.name });
    await logActivity(admin.id, "update", "user", userId, `Updated user "${data.name}"`);
    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const admin = await requireRole(["admin"]);
    const { id } = await params;
    const userId = Number(id);
    if (admin.id === userId) throw new HttpError(400, "You cannot delete your own account");
    await db.delete(users).where(eq(users.id, userId));
    await logActivity(admin.id, "delete", "user", userId, `Deleted user #${userId}`);
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
