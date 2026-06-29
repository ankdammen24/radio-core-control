/**
 * Drizzle connection check
 *
 * Verifies that DATABASE_URL is set and that Drizzle can connect to PostgreSQL.
 * Run with:
 *   npx tsx src/server/db/check.ts
 *
 * Expected output (success):
 *   ✓ DATABASE_URL is set
 *   ✓ Connected to PostgreSQL X.Y
 *   ✓ Schema tables are accessible
 */

import postgres from "postgres";

async function check() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    console.error("✗ DATABASE_URL is not set");
    console.error("  Copy .env.example to .env and set DATABASE_URL");
    process.exit(1);
  }

  console.log("✓ DATABASE_URL is set");

  const sql = postgres(url, { max: 1, connect_timeout: 10 });

  try {
    // 1. Basic connectivity + server version
    const [{ version }] = await sql<{ version: string }[]>`SELECT version()`;
    const short = version.match(/PostgreSQL [\d.]+/)?.[0] ?? version.slice(0, 40);
    console.log(`✓ Connected to ${short}`);

    // 2. List tables visible to this user (public schema)
    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;

    if (tables.length === 0) {
      console.log("ℹ No tables found in public schema (run migrations to create them)");
    } else {
      console.log(`✓ ${tables.length} table(s) in public schema:`);
      tables.forEach((t) => console.log(`    • ${t.tablename}`));
    }
  } catch (err) {
    console.error("✗ Connection failed:", (err as Error).message);
    process.exit(1);
  } finally {
    await sql.end();
  }

  console.log("\n✓ All checks passed — Drizzle is ready to connect.");
}

check();
