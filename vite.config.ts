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

// Vercel sets process.env.VERCEL = '1' in all build environments automatically.
// This ensures Nitro uses its Vercel adapter (output → .vercel/output/) without
// requiring a separate NITRO_PRESET env var to be configured manually.
const nitroPreset = process.env.VERCEL
  ? "vercel"
  : (process.env.NITRO_PRESET ?? "node");

export default defineConfig({
  // Vercel's Supabase integration uses NEXT_PUBLIC_RC_SUPABASE_* for the
  // browser-safe URL/publishable key. Never expose the unprefixed RC secrets.
  envPrefix: ["VITE_", "NEXT_PUBLIC_RC_SUPABASE_"],
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({ server: { preset: nitroPreset } }),
    react(),
  ],
  server: {
    port: 3000,
  },
});
