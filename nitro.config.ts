import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  preset: process.env.VERCEL ? "vercel" : (process.env.NITRO_PRESET ?? "node"),
});
