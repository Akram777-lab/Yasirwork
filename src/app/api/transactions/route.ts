import { db } from "@/db";
import { categories, transactions, users } from "@/db/schema";
import { canSeeAll, logActivity, requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { transactionSchema } from "@/lib/validation";
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const p = url.searchParams;

    const filters: SQL[] = [];
    if (!canSeeAll(user)) filters.push(eq(transactions.userId, user.id));
    const userId = p.get("userId");
    if (userId && canSeeAll(user)) filters.push(eq(transactions.userId, Number(userId)));
    const type = p.get("type");
    if (type && type !== "all") filters.push(eq(transactions.type, type));
    const status = p.get("status");
    if (status && status !== "all") filters.push(eq(transactions.status, status));
    const categoryId = p.get("categoryId");
    if (categoryId && categoryId !== "all") filters.push(eq(transactions.categoryId, Number(categoryId)));
    const from = p.get("from");
    if (from) filters.push(gte(transactions.txnDate, from));
    const to = p.get("to");
    if (to) filters.push(lte(transactions.txnDate, to));
    const q = p.get("q");
    if (q) {
      const like = `%${q}%`;
      const search = or(
        ilike(transactions.title, like),
        ilike(transactions.vendor, like),
        ilike(transactions.reference, like),
        ilike(transactions.notes, like),
      );
      if (search) filters.push(search);
    }

    const where = filters.length ? and(...filters) : undefined;
    const limit = Math.min(Number(p.get("limit") ?? 200), 1000);

    const rows = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        title: transactions.title,
        amount: transactions.amount,
        txnDate: transactions.txnDate,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        userId: transactions.userId,
        userName: users.name,
        paymentMethod: transactions.paymentMethod,
        vendor: transactions.vendor,
        reference: transactions.reference,
        notes: transactions.notes,
        status: transactions.status,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .leftJoin(users, eq(users.id, transactions.userId))
      .where(where)
      .orderBy(desc(transactions.txnDate), desc(transactions.id))
      .limit(limit);

    const totals = await db
      .select({
        income: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`,
        expense: sql<string>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .where(where);

    return ok({
      items: rows,
      totals: {
        income: Number(totals[0]?.income ?? 0),
        expense: Number(totals[0]?.expense ?? 0),
        count: totals[0]?.count ?? 0,
      },
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const data = transactionSchema.parse(await request.json());
    const targetUser = canSeeAll(user) && data.userId ? data.userId : user.id;
    const status = canSeeAll(user) ? (data.status ?? "approved") : "pending";

    const [created] = await db
      .insert(transactions)
      .values({
        type: data.type,
        title: data.title,
        amount: data.amount.toFixed(2),
        txnDate: data.txnDate,
        categoryId: data.categoryId ?? null,
        userId: targetUser,
        paymentMethod: data.paymentMethod,
        vendor: data.vendor || null,
        reference: data.reference || null,
        notes: data.notes || null,
        status,
      })
      .returning();

    await logActivity(user.id, "create", "transaction", created.id, `${data.type} "${data.title}" for ${data.amount}`);
    return ok(created, 201);
  } catch (error) {
    return fail(error);
  }
}
