import { db } from "@/db";
import { categories, users, workLogs } from "@/db/schema";
import { canSeeAll, logActivity, requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { workLogSchema } from "@/lib/validation";
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const p = new URL(request.url).searchParams;
    const filters: SQL[] = [];
    if (!canSeeAll(user)) filters.push(eq(workLogs.userId, user.id));
    const userId = p.get("userId");
    if (userId && userId !== "all" && canSeeAll(user)) filters.push(eq(workLogs.userId, Number(userId)));
    const status = p.get("status");
    if (status && status !== "all") filters.push(eq(workLogs.status, status));
    const categoryId = p.get("categoryId");
    if (categoryId && categoryId !== "all") filters.push(eq(workLogs.categoryId, Number(categoryId)));
    const from = p.get("from");
    if (from) filters.push(gte(workLogs.logDate, from));
    const to = p.get("to");
    if (to) filters.push(lte(workLogs.logDate, to));
    const q = p.get("q");
    if (q) {
      const like = `%${q}%`;
      const search = or(ilike(workLogs.title, like), ilike(workLogs.description, like), ilike(workLogs.project, like));
      if (search) filters.push(search);
    }
    const where = filters.length ? and(...filters) : undefined;

    const rows = await db
      .select({
        id: workLogs.id,
        userId: workLogs.userId,
        userName: users.name,
        logDate: workLogs.logDate,
        title: workLogs.title,
        description: workLogs.description,
        project: workLogs.project,
        hours: workLogs.hours,
        categoryId: workLogs.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        status: workLogs.status,
        createdAt: workLogs.createdAt,
      })
      .from(workLogs)
      .leftJoin(users, eq(users.id, workLogs.userId))
      .leftJoin(categories, eq(categories.id, workLogs.categoryId))
      .where(where)
      .orderBy(desc(workLogs.logDate), desc(workLogs.id))
      .limit(500);

    const totals = await db
      .select({
        hours: sql<string>`coalesce(sum(${workLogs.hours}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(workLogs)
      .where(where);

    return ok({ items: rows, totals: { hours: Number(totals[0]?.hours ?? 0), count: totals[0]?.count ?? 0 } });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const data = workLogSchema.parse(await request.json());
    const [created] = await db
      .insert(workLogs)
      .values({
        userId: canSeeAll(user) && data.userId ? data.userId : user.id,
        logDate: data.logDate,
        title: data.title,
        description: data.description || null,
        project: data.project || null,
        hours: data.hours.toFixed(2),
        categoryId: data.categoryId ?? null,
        status: data.status,
      })
      .returning();
    await logActivity(user.id, "create", "work_log", created.id, `Logged work "${data.title}" (${data.hours}h)`);
    return ok(created, 201);
  } catch (error) {
    return fail(error);
  }
}
