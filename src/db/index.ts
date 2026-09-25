import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Lazily create the pool so the build step never crashes if DATABASE_URL
// isn't set (e.g. during `next build` on Vercel before env vars are wired).
let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getPool(): Pool {
  if (_pool) return _pool;
  const url =
    process.env.DATABASE_URL ??
    "postgresql://neondb_owner:npg_X0PWmLHOu7JQ@ep-rapid-truth-b52is8ix-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";
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
