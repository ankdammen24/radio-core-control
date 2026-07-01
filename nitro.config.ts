import { defineNitroConfig } from "nitro/config";

// Railway and other Node hosts: default preset outputs to .output/server/index.mjs
// Vercel: keep as fallback if someone deploys there
export default defineNitroConfig({
  preset: process.env.VERCEL ? "vercel" : "node",
});
