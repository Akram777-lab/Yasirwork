import { db } from "@/db";
import { categories, users } from "@/db/schema";
import { createSession, hashPassword, logActivity } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { eq, sql } from "drizzle-orm";

const DEFAULT_CATEGORIES = [
  { name: "Office Supplies", type: "expense", color: "#6366f1" },
  { name: "Travel & Transport", type: "expense", color: "#f59e0b" },
  { name: "Meals & Entertainment", type: "expense", color: "#ef4444" },
  { name: "Utilities", type: "expense", color: "#0ea5e9" },
  { name: "Software & Subscriptions", type: "expense", color: "#8b5cf6" },
  { name: "Salaries", type: "expense", color: "#14b8a6" },
  { name: "Client Payment", type: "income", color: "#22c55e" },
  { name: "Product Sales", type: "income", color: "#10b981" },
  { name: "Consulting", type: "income", color: "#84cc16" },
  { name: "Client Meeting", type: "work", color: "#3b82f6" },
  { name: "Development", type: "work", color: "#a855f7" },
  { name: "Admin Work", type: "work", color: "#64748b" },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);
    const email = data.email.toLowerCase().trim();

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return ok({ error: "An account with this email already exists" }, 409);
    }

    const countRows = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const isFirst = (countRows[0]?.count ?? 0) === 0;

    const [created] = await db
      .insert(users)
      .values({
        name: data.name.trim(),
        email,
        passwordHash: hashPassword(data.password),
        role: isFirst ? "admin" : "employee",
        jobTitle: data.jobTitle || null,
        department: data.department || null,
        isActive: true,
      })
      .returning();

    if (isFirst) {
      await db.insert(categories).values(DEFAULT_CATEGORIES);
    }

    await createSession(created.id);
    await logActivity(created.id, "register", "user", created.id, `${created.name} created an account`);

    return ok({ id: created.id, role: created.role });
  } catch (error) {
    return fail(error);
  }
}
