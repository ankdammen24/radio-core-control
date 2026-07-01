/**
 * Drizzle ORM client — PostgreSQL via `postgres` driver.
 *
 * DATABASE_URL must be a standard PostgreSQL connection string:
 *   postgresql://user:password@host:5432/dbname
 *
 * During transition: point at the Supabase direct connection string
 *   (Settings → Database → Connection string → URI, port 5432).
 * After migration: point at Neon or self-hosted PostgreSQL.
 *
 * Switch to @neondatabase/serverless when on Neon:
 *   import { neon } from "@neondatabase/serverless";
 *   import { drizzle } from "drizzle-orm/neon-http";
 *   export const db = drizzle(neon(process.env.DATABASE_URL!), { schema });
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index";

function createDb() {
  // Prefer the explicit DATABASE_URL when set (e.g. Neon / self-hosted).
  // Fall back to Lovable Cloud's managed Supabase pooler connection string
  // (`SUPABASE_DB_URL`), which is injected server-side and points at the
  // pgbouncer pool — the correct endpoint for serverless workers.
  const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!url) {
    throw new Error(
      "No database connection string found: set DATABASE_URL or ensure SUPABASE_DB_URL is available",
    );
  }

  // Detect the Supabase transaction pooler (port 6543) — it does not support
  // prepared statements, which the `postgres` driver enables by default.
  const isPooler = /:6543\//.test(url) || /pgbouncer=true/i.test(url);

  const client = postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: !isPooler,
  });

  return drizzle(client, { schema });
}

// Singleton — reused across requests in the same serverless invocation
let _db: ReturnType<typeof createDb> | undefined;

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}

/** Convenience re-export for direct use */
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
