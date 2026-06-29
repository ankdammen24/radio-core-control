import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Introspect only public schema — skip Supabase-internal schemas (auth, storage)
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
});
