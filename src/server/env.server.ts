import { readFileSync } from "node:fs";

export function readEnv(name: string, fallback?: string): string | undefined {
  const direct = process.env[name]?.trim();
  if (direct) return direct;

  const filePath = process.env[`${name}_FILE`]?.trim();
  if (filePath) {
    try {
      const fromFile = readFileSync(filePath, "utf8").trim();
      if (fromFile) return fromFile;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed reading ${name}_FILE at "${filePath}": ${detail}`);
    }
  }

  return fallback;
}

export function readEnvOrThrow(name: string): string {
  const value = readEnv(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
