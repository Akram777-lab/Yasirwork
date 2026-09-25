import { db } from "@/db";
import { activityLogs, categories, tasks, transactions, users, workLogs } from "@/db/schema";
import { and, desc, eq, gte, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { canSeeAll, type SessionUser } from "@/lib/auth";

function iso(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export async function getDashboardData(user: SessionUser) {
  const now = new Date();
  const monthStart = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const trendStart = iso(new Date(now.getFullYear(), now.getMonth() - 5, 1));
  const all = canSeeAll(user);

  const scopeTxn = (extra: SQL[]) =>
    and(...(all ? extra : [...extra, eq(transactions.userId, user.id)]));

  const [monthTotals] = await db
    .select({
      income: sql<string>`coalesce(sum(case when ${transactions.type}='income' then ${transactions.amount} else 0 end),0)`,
      expense: sql<string>`coalesce(sum(case when ${transactions.type}='expense' then ${transactions.amount} else 0 end),0)`,
      pending: sql<number>`coalesce(sum(case when ${transactions.status}='pending' then 1 else 0 end),0)::int`,
    })
    .from(transactions)
    .where(scopeTxn([gte(transactions.txnDate, monthStart), lte(transactions.txnDate, monthEnd)]));

  const trend = await db
    .select({
      month: sql<string>`to_char(${transactions.txnDate}, 'YYYY-MM')`,
      income: sql<string>`coalesce(sum(case when ${transactions.type}='income' then ${transactions.amount} else 0 end),0)`,
      expense: sql<string>`coalesce(sum(case when ${transactions.type}='expense' then ${transactions.amount} else 0 end),0)`,
    })
    .from(transactions)
    .where(scopeTxn([gte(transactions.txnDate, trendStart), lte(transactions.txnDate, monthEnd)]))
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
    .where(
      and(
        scopeTxn([gte(transactions.txnDate, monthStart), lte(transactions.txnDate, monthEnd)]),
        eq(transactions.type, "expense"),
      ),
    )
    .groupBy(categories.name, categories.color)
    .orderBy(desc(sql`coalesce(sum(${transactions.amount}),0)`))
    .limit(6);

  const hoursFilters: SQL[] = [gte(workLogs.logDate, monthStart), lte(workLogs.logDate, monthEnd)];
  if (!all) hoursFilters.push(eq(workLogs.userId, user.id));
  const [hours] = await db
    .select({ hours: sql<string>`coalesce(sum(${workLogs.hours}),0)`, entries: sql<number>`count(*)::int` })
    .from(workLogs)
    .where(and(...hoursFilters));

  const taskScope = all ? undefined : or(eq(tasks.assigneeId, user.id), eq(tasks.createdById, user.id));
  const [taskCounts] = await db
    .select({
      open: sql<number>`coalesce(sum(case when ${tasks.status} <> 'done' then 1 else 0 end),0)::int`,
      overdue: sql<number>`coalesce(sum(case when ${tasks.status} <> 'done' and ${tasks.dueDate} < current_date then 1 else 0 end),0)::int`,
      done: sql<number>`coalesce(sum(case when ${tasks.status} = 'done' then 1 else 0 end),0)::int`,
    })
    .from(tasks)
    .where(taskScope);

  const recentTransactions = await db
    .select({
      id: transactions.id,
      title: transactions.title,
      amount: transactions.amount,
      type: transactions.type,
      status: transactions.status,
      txnDate: transactions.txnDate,
      categoryName: categories.name,
      userName: users.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(users, eq(users.id, transactions.userId))
    .where(all ? undefined : eq(transactions.userId, user.id))
    .orderBy(desc(transactions.txnDate), desc(transactions.id))
    .limit(6);

  const upcomingTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      followUpDate: tasks.followUpDate,
      priority: tasks.priority,
      status: tasks.status,
      assigneeName: users.name,
    })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(ne(tasks.status, "done"), ...(taskScope ? [taskScope] : [])))
    .orderBy(sql`${tasks.dueDate} asc nulls last`)
    .limit(6);

  const recentWork = await db
    .select({
      id: workLogs.id,
      title: workLogs.title,
      logDate: workLogs.logDate,
      hours: workLogs.hours,
      project: workLogs.project,
      userName: users.name,
      status: workLogs.status,
    })
    .from(workLogs)
    .leftJoin(users, eq(users.id, workLogs.userId))
    .where(all ? undefined : eq(workLogs.userId, user.id))
    .orderBy(desc(workLogs.logDate), desc(workLogs.id))
    .limit(6);

  const activity = await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      entity: activityLogs.entity,
      detail: activityLogs.detail,
      createdAt: activityLogs.createdAt,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(users.id, activityLogs.userId))
    .where(all ? undefined : eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(8);

  const topSpenders = all
    ? await db
        .select({
          name: sql<string>`coalesce(${users.name},'Unknown')`,
          total: sql<string>`coalesce(sum(${transactions.amount}),0)`,
        })
        .from(transactions)
        .leftJoin(users, eq(users.id, transactions.userId))
        .where(
          and(
            eq(transactions.type, "expense"),
            gte(transactions.txnDate, monthStart),
            lte(transactions.txnDate, monthEnd),
          ),
        )
        .groupBy(users.name)
        .orderBy(desc(sql`coalesce(sum(${transactions.amount}),0)`))
        .limit(5)
    : [];

  return {
    monthStart,
    monthEnd,
    totals: {
      income: Number(monthTotals?.income ?? 0),
      expense: Number(monthTotals?.expense ?? 0),
      net: Number(monthTotals?.income ?? 0) - Number(monthTotals?.expense ?? 0),
      pending: monthTotals?.pending ?? 0,
      hours: Number(hours?.hours ?? 0),
      entries: hours?.entries ?? 0,
      openTasks: taskCounts?.open ?? 0,
      overdueTasks: taskCounts?.overdue ?? 0,
      doneTasks: taskCounts?.done ?? 0,
    },
    trend: trend.map((t) => ({ month: t.month, income: Number(t.income), expense: Number(t.expense) })),
    byCategory: byCategory.map((c) => ({ name: c.name, color: c.color, total: Number(c.total) })),
    recentTransactions,
    upcomingTasks,
    recentWork,
    activity,
    topSpenders: topSpenders.map((t) => ({ name: t.name, total: Number(t.total) })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;


