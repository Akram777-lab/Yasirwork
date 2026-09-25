import { db } from "@/db";
import { activityLogs, users } from "@/db/schema";
import { canSeeAll, requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const p = new URL(request.url).searchParams;
    const filters: SQL[] = [];
    if (!canSeeAll(user)) filters.push(eq(activityLogs.userId, user.id));
    const userId = p.get("userId");
    if (userId && userId !== "all" && canSeeAll(user)) filters.push(eq(activityLogs.userId, Number(userId)));
    const entity = p.get("entity");
    if (entity && entity !== "all") filters.push(eq(activityLogs.entity, entity));
    const q = p.get("q");
    if (q) {
      const like = `%${q}%`;
      const search = or(ilike(activityLogs.detail, like), ilike(activityLogs.action, like));
      if (search) filters.push(search);
    }

    const rows = await db
      .select({
        id: activityLogs.id,
        userId: activityLogs.userId,
        userName: users.name,
        action: activityLogs.action,
        entity: activityLogs.entity,
        entityId: activityLogs.entityId,
        detail: activityLogs.detail,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs)
      .leftJoin(users, eq(users.id, activityLogs.userId))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(activityLogs.createdAt))
      .limit(Math.min(Number(p.get("limit") ?? 200), 500));

    return ok({ items: rows });
  } catch (error) {
    return fail(error);
  }
}
