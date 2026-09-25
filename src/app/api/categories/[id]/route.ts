import { db } from "@/db";
import { categories } from "@/db/schema";
import { logActivity, requireRole } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { categorySchema } from "@/lib/validation";
import { eq } from "drizzle-orm";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const data = categorySchema.parse(await request.json());
    const [updated] = await db
      .update(categories)
      .set({
        name: data.name,
        type: data.type,
        color: data.color,
        description: data.description || null,
        isActive: data.isActive ?? true,
      })
      .where(eq(categories.id, Number(id)))
      .returning();
    await logActivity(user.id, "update", "category", Number(id), `Updated category "${data.name}"`);
    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const user = await requireRole(["admin"]);
    const { id } = await params;
    await db.delete(categories).where(eq(categories.id, Number(id)));
    await logActivity(user.id, "delete", "category", Number(id), `Deleted category #${id}`);
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
