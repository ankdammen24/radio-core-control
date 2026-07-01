/**
 * Vite configuration — open-source stack (no Lovable dependencies).
 *
 * Replaces: @lovable.dev/vite-tanstack-config
 *
 * Plugins used:
 *   - @tanstack/react-start/vite  — TanStack Start SSR + server functions
 *   - @vitejs/plugin-react        — React 19 + Fast Refresh
 *   - @tailwindcss/vite           — Tailwind CSS v4
 *   - vite-tsconfig-paths         — @ path alias from tsconfig.json
 */
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  envPrefix: ["VITE_", "NEXT_PUBLIC_RC_SUPABASE_"],
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart(),
    react(),
  ],
  server: {
    port: 3000,
  },
});
