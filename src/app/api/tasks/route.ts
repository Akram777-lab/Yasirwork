import { db } from "@/db";
import { tasks, users } from "@/db/schema";
import { canSeeAll, logActivity, requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { taskSchema } from "@/lib/validation";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, ilike, or, type SQL } from "drizzle-orm";

const assignee = alias(users, "assignee");
const creator = alias(users, "creator");

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const p = new URL(request.url).searchParams;
    const filters: SQL[] = [];
    if (!canSeeAll(user)) {
      const mine = or(eq(tasks.assigneeId, user.id), eq(tasks.createdById, user.id));
      if (mine) filters.push(mine);
    }
    const status = p.get("status");
    if (status && status !== "all") filters.push(eq(tasks.status, status));
    const priority = p.get("priority");
    if (priority && priority !== "all") filters.push(eq(tasks.priority, priority));
    const assigneeId = p.get("assigneeId");
    if (assigneeId && assigneeId !== "all") filters.push(eq(tasks.assigneeId, Number(assigneeId)));
    const q = p.get("q");
    if (q) {
      const like = `%${q}%`;
      const search = or(ilike(tasks.title, like), ilike(tasks.description, like));
      if (search) filters.push(search);
    }
    const where = filters.length ? and(...filters) : undefined;

    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        assigneeId: tasks.assigneeId,
        assigneeName: assignee.name,
        createdById: tasks.createdById,
        createdByName: creator.name,
        dueDate: tasks.dueDate,
        followUpDate: tasks.followUpDate,
        priority: tasks.priority,
        status: tasks.status,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .leftJoin(assignee, eq(assignee.id, tasks.assigneeId))
      .leftJoin(creator, eq(creator.id, tasks.createdById))
      .where(where)
      .orderBy(asc(tasks.status), desc(tasks.createdAt))
      .limit(500);

    return ok({ items: rows });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const data = taskSchema.parse(await request.json());
    const [created] = await db
      .insert(tasks)
      .values({
        title: data.title,
        description: data.description || null,
        assigneeId: data.assigneeId ?? user.id,
        createdById: user.id,
        dueDate: data.dueDate || null,
        followUpDate: data.followUpDate || null,
        priority: data.priority,
        status: data.status,
        completedAt: data.status === "done" ? new Date() : null,
      })
      .returning();
    await logActivity(user.id, "create", "task", created.id, `Created task "${data.title}"`);
    return ok(created, 201);
  } catch (error) {
    return fail(error);
  }
}
