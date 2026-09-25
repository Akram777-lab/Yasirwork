import { db } from "@/db";
import { categories } from "@/db/schema";
import { logActivity, requireRole, requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { categorySchema } from "@/lib/validation";
import { asc, eq, and, type SQL } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    await requireUser();
    const p = new URL(request.url).searchParams;
    const filters: SQL[] = [];
    const type = p.get("type");
    if (type && type !== "all") filters.push(eq(categories.type, type));
    if (p.get("activeOnly") === "true") filters.push(eq(categories.isActive, true));
    const rows = await db
      .select()
      .from(categories)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(asc(categories.type), asc(categories.name));
    return ok({ items: rows });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const data = categorySchema.parse(await request.json());
    const [created] = await db
      .insert(categories)
      .values({
        name: data.name,
        type: data.type,
        color: data.color,
        description: data.description || null,
        isActive: data.isActive ?? true,
      })
      .returning();
    await logActivity(user.id, "create", "category", created.id, `Created category "${data.name}"`);
    return ok(created, 201);
  } catch (error) {
    return fail(error);
  }
}
