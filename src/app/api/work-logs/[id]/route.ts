import { db } from "@/db";
import { workLogs } from "@/db/schema";
import { canSeeAll, HttpError, logActivity, requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { workLogSchema } from "@/lib/validation";
import { eq } from "drizzle-orm";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: number) {
  const rows = await db.select().from(workLogs).where(eq(workLogs.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Work log not found");
  return rows[0];
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const record = await load(Number(id));
    if (!canSeeAll(user) && record.userId !== user.id) throw new HttpError(403, "Not allowed");
    const data = workLogSchema.parse(await request.json());
    const [updated] = await db
      .update(workLogs)
      .set({
        logDate: data.logDate,
        title: data.title,
        description: data.description || null,
        project: data.project || null,
        hours: data.hours.toFixed(2),
        categoryId: data.categoryId ?? null,
        status: data.status,
        userId: canSeeAll(user) && data.userId ? data.userId : record.userId,
      })
      .where(eq(workLogs.id, record.id))
      .returning();
    await logActivity(user.id, "update", "work_log", record.id, `Updated work log "${data.title}"`);
    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const record = await load(Number(id));
    if (!canSeeAll(user) && record.userId !== user.id) throw new HttpError(403, "Not allowed");
    await db.delete(workLogs).where(eq(workLogs.id, record.id));
    await logActivity(user.id, "delete", "work_log", record.id, `Deleted work log "${record.title}"`);
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
