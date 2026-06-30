import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const packageJsonPath = fileURLToPath(new URL("../../package.json", import.meta.url));
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { version?: string };

export const apiConfig = Object.freeze({
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV ?? "development",
  publicUrl: process.env.API_PUBLIC_URL ?? null,
  version: packageJson.version ?? "0.0.0",
});
