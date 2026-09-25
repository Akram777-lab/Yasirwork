import { db } from "@/db";
import { tasks } from "@/db/schema";
import { canSeeAll, HttpError, logActivity, requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { taskSchema } from "@/lib/validation";
import { eq } from "drizzle-orm";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: number) {
  const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Task not found");
  return rows[0];
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const record = await load(Number(id));
    const mine = record.assigneeId === user.id || record.createdById === user.id;
    if (!canSeeAll(user) && !mine) throw new HttpError(403, "Not allowed");

    const body = await request.json();
    if (Object.keys(body).length === 1 && typeof body.status === "string") {
      const [updated] = await db
        .update(tasks)
        .set({ status: body.status, completedAt: body.status === "done" ? new Date() : null })
        .where(eq(tasks.id, record.id))
        .returning();
      await logActivity(user.id, "update", "task", record.id, `Moved "${record.title}" to ${body.status}`);
      return ok(updated);
    }

    const data = taskSchema.parse(body);
    const [updated] = await db
      .update(tasks)
      .set({
        title: data.title,
        description: data.description || null,
        assigneeId: data.assigneeId ?? null,
        dueDate: data.dueDate || null,
        followUpDate: data.followUpDate || null,
        priority: data.priority,
        status: data.status,
        completedAt: data.status === "done" ? (record.completedAt ?? new Date()) : null,
      })
      .where(eq(tasks.id, record.id))
      .returning();
    await logActivity(user.id, "update", "task", record.id, `Updated task "${data.title}"`);
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
    const mine = record.assigneeId === user.id || record.createdById === user.id;
    if (!canSeeAll(user) && !mine) throw new HttpError(403, "Not allowed");
    await db.delete(tasks).where(eq(tasks.id, record.id));
    await logActivity(user.id, "delete", "task", record.id, `Deleted task "${record.title}"`);
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
