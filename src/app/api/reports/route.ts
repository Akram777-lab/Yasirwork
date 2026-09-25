import { db } from "@/db";
import { categories, tasks, transactions, users, workLogs } from "@/db/schema";
import { canSeeAll, requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

function defaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end) };
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const p = new URL(request.url).searchParams;
    const range = defaultRange();
    const from = p.get("from") || range.from;
    const to = p.get("to") || range.to;
    const scopeUser = p.get("userId");

    const txnFilters: SQL[] = [gte(transactions.txnDate, from), lte(transactions.txnDate, to)];
    const logFilters: SQL[] = [gte(workLogs.logDate, from), lte(workLogs.logDate, to)];
    if (!canSeeAll(user)) {
      txnFilters.push(eq(transactions.userId, user.id));
      logFilters.push(eq(workLogs.userId, user.id));
    } else if (scopeUser && scopeUser !== "all") {
      txnFilters.push(eq(transactions.userId, Number(scopeUser)));
      logFilters.push(eq(workLogs.userId, Number(scopeUser)));
    }
    const txnWhere = and(...txnFilters);
    const logWhere = and(...logFilters);

    const [totals] = await db
      .select({
        income: sql<string>`coalesce(sum(case when ${transactions.type}='income' then ${transactions.amount} else 0 end),0)`,
        expense: sql<string>`coalesce(sum(case when ${transactions.type}='expense' then ${transactions.amount} else 0 end),0)`,
        pending: sql<number>`coalesce(sum(case when ${transactions.status}='pending' then 1 else 0 end),0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .where(txnWhere);

    const monthly = await db
      .select({
        month: sql<string>`to_char(${transactions.txnDate}, 'YYYY-MM')`,
        income: sql<string>`coalesce(sum(case when ${transactions.type}='income' then ${transactions.amount} else 0 end),0)`,
        expense: sql<string>`coalesce(sum(case when ${transactions.type}='expense' then ${transactions.amount} else 0 end),0)`,
      })
      .from(transactions)
      .where(txnWhere)
      .groupBy(sql`to_char(${transactions.txnDate}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${transactions.txnDate}, 'YYYY-MM')`);

    const byCategory = await db
      .select({
        name: sql<string>`coalesce(${categories.name}, 'Uncategorized')`,
        color: sql<string>`coalesce(${categories.color}, '#94a3b8')`,
        total: sql<string>`coalesce(sum(${transactions.amount}),0)`,
      })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(txnWhere, eq(transactions.type, "expense")))
      .groupBy(categories.name, categories.color)
      .orderBy(desc(sql`coalesce(sum(${transactions.amount}),0)`))
      .limit(12);

    const byUser = await db
      .select({
        name: sql<string>`coalesce(${users.name}, 'Unknown')`,
        expense: sql<string>`coalesce(sum(case when ${transactions.type}='expense' then ${transactions.amount} else 0 end),0)`,
        income: sql<string>`coalesce(sum(case when ${transactions.type}='income' then ${transactions.amount} else 0 end),0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .leftJoin(users, eq(users.id, transactions.userId))
      .where(txnWhere)
      .groupBy(users.name)
      .orderBy(desc(sql`coalesce(sum(case when ${transactions.type}='expense' then ${transactions.amount} else 0 end),0)`))
      .limit(12);

    const hoursByUser = await db
      .select({
        name: sql<string>`coalesce(${users.name}, 'Unknown')`,
        hours: sql<string>`coalesce(sum(${workLogs.hours}),0)`,
        entries: sql<number>`count(*)::int`,
      })
      .from(workLogs)
      .leftJoin(users, eq(users.id, workLogs.userId))
      .where(logWhere)
      .groupBy(users.name)
      .orderBy(desc(sql`coalesce(sum(${workLogs.hours}),0)`))
      .limit(12);

    const [hoursTotal] = await db
      .select({ hours: sql<string>`coalesce(sum(${workLogs.hours}),0)`, entries: sql<number>`count(*)::int` })
      .from(workLogs)
      .where(logWhere);

    const taskStats = await db
      .select({ status: tasks.status, count: sql<number>`count(*)::int` })
      .from(tasks)
      .groupBy(tasks.status);

    return ok({
      range: { from, to },
      totals: {
        income: Number(totals?.income ?? 0),
        expense: Number(totals?.expense ?? 0),
        net: Number(totals?.income ?? 0) - Number(totals?.expense ?? 0),
        pending: totals?.pending ?? 0,
        count: totals?.count ?? 0,
        hours: Number(hoursTotal?.hours ?? 0),
        entries: hoursTotal?.entries ?? 0,
      },
      monthly: monthly.map((m) => ({
        month: m.month,
        income: Number(m.income),
        expense: Number(m.expense),
        net: Number(m.income) - Number(m.expense),
      })),
      byCategory: byCategory.map((c) => ({ name: c.name, color: c.color, total: Number(c.total) })),
      byUser: byUser.map((u) => ({
        name: u.name,
        expense: Number(u.expense),
        income: Number(u.income),
        count: u.count,
      })),
      hoursByUser: hoursByUser.map((h) => ({ name: h.name, hours: Number(h.hours), entries: h.entries })),
      taskStats: taskStats.map((t) => ({ status: t.status, count: t.count })),
    });
  } catch (error) {
    return fail(error);
  }
}
