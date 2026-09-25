import { db } from "@/db";
import { transactions } from "@/db/schema";
import { canSeeAll, HttpError, logActivity, requireUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { transactionSchema } from "@/lib/validation";
import { eq } from "drizzle-orm";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: number) {
  const rows = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!rows[0]) throw new HttpError(404, "Transaction not found");
  return rows[0];
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const record = await load(Number(id));
    if (!canSeeAll(user) && record.userId !== user.id) throw new HttpError(403, "Not allowed");

    const body = await request.json();
    // status-only update (approve / reject)
    if (Object.keys(body).length === 1 && typeof body.status === "string") {
      if (!canSeeAll(user)) throw new HttpError(403, "Only managers can change status");
      const [updated] = await db
        .update(transactions)
        .set({ status: body.status })
        .where(eq(transactions.id, record.id))
        .returning();
      await logActivity(user.id, body.status, "transaction", record.id, `Marked "${record.title}" as ${body.status}`);
      return ok(updated);
    }

    const data = transactionSchema.parse(body);
    const [updated] = await db
      .update(transactions)
      .set({
        type: data.type,
        title: data.title,
        amount: data.amount.toFixed(2),
        txnDate: data.txnDate,
        categoryId: data.categoryId ?? null,
        paymentMethod: data.paymentMethod,
        vendor: data.vendor || null,
        reference: data.reference || null,
        notes: data.notes || null,
        status: canSeeAll(user) ? (data.status ?? record.status) : record.status,
        userId: canSeeAll(user) && data.userId ? data.userId : record.userId,
      })
      .where(eq(transactions.id, record.id))
      .returning();

    await logActivity(user.id, "update", "transaction", record.id, `Updated "${data.title}"`);
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
    await db.delete(transactions).where(eq(transactions.id, record.id));
    await logActivity(user.id, "delete", "transaction", record.id, `Deleted "${record.title}"`);
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
