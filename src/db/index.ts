import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Lazily create the pool so the build step never crashes if DATABASE_URL
// isn't set (e.g. during `next build` on Vercel before env vars are wired).
let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getPool(): Pool {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables.",
    );
  }
  _pool = new Pool({ connectionString: url });
  return _pool;
}

export function getDb() {
  if (_db) return _db;
  _db = drizzle(getPool());
  return _db;
}

// Keep a convenience `db` export that existing code can use.
// It only connects when first accessed (not at import time).
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
