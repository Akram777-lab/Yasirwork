import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, activityLogs, type User } from "@/db/schema";

export const SESSION_COOKIE = "worktrack_session";
const SESSION_DAYS = 30;

export type Role = "admin" | "manager" | "employee";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  department: string | null;
  isActive: boolean;
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const original = Buffer.from(hash, "hex");
  if (candidate.length !== original.length) return false;
  return timingSafeEqual(candidate, original);
}

export function toSessionUser(u: User): SessionUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as Role,
    jobTitle: u.jobTitle,
    department: u.department,
    isActive: u.isActive,
  };
}

export async function createSession(userId: number) {
  const token = randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(sessions).values({ token, userId, expiresAt });
  const store = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // The preview is served inside a cross-origin iframe, so the session
    // cookie must be SameSite=None + Secure to be stored/sent by the browser.
    sameSite: isProd ? "none" : "lax",
    path: "/",
    secure: isProd,
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  store.delete(SESSION_COOKIE);
}

/**
 * When AUTH_DISABLED is not explicitly "false", the app runs in open-access
 * mode: no sign-in is required and every request is treated as the default
 * administrator. This avoids third-party cookie problems inside iframes.
 */
export const AUTH_DISABLED = process.env.AUTH_DISABLED !== "false";

// Remember only which user id is the default; always re-read the row so that
// profile/name/role edits show up immediately (no stale cache, no restart).
let defaultUserId: number | null = null;

export async function getDefaultUser(): Promise<SessionUser> {
  if (defaultUserId !== null) {
    const cached = await db.select().from(users).where(eq(users.id, defaultUserId)).limit(1);
    if (cached[0]?.isActive) return toSessionUser(cached[0]);
    defaultUserId = null; // fell through: user was removed or disabled
  }

  // Prefer an existing admin, then any active user.
  const adminRows = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  let record = adminRows[0];
  if (!record) {
    const anyRows = await db.select().from(users).limit(1);
    record = anyRows[0];
  }
  if (!record) {
    // Fresh database: create a default administrator so the app always works.
    const inserted = await db
      .insert(users)
      .values({
        name: "Workspace Admin",
        email: "admin@worktrack.app",
        passwordHash: hashPassword("admin123"),
        role: "admin",
        jobTitle: "Administrator",
        department: "Management",
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();
    record = inserted[0] ?? (await db.select().from(users).limit(1))[0];
  }
  defaultUserId = record.id;
  return toSessionUser(record);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const rows = await db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
      .limit(1);
    const row = rows[0];
    if (row && row.user.isActive) return toSessionUser(row.user);
  }
  // Open-access fallback: no valid session -> act as the default admin.
  if (AUTH_DISABLED) {
    try {
      return await getDefaultUser();
    } catch {
      return null;
    }
  }
  return null;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Authentication required");
  return user;
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new HttpError(403, "You do not have permission for this action");
  return user;
}

/** Managers and admins can see everyone's records; employees only their own. */
export function canSeeAll(user: SessionUser) {
  return user.role === "admin" || user.role === "manager";
}

export async function logActivity(
  userId: number | null,
  action: string,
  entity: string,
  entityId: number | null,
  detail: string,
) {
  try {
    await db.insert(activityLogs).values({ userId, action, entity, entityId, detail });
  } catch {
    // logging must never break the request
  }
}
