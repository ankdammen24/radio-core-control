import { existsSync } from "node:fs";
import { statfs } from "node:fs/promises";
import os from "node:os";
import { apiConfig } from "../config/api.js";
import { pingMongo } from "../database/mongo.js";

export interface HealthChecks {
  mongodb: { ok: boolean; latencyMs?: number; error?: string };
  disk: { ok: boolean; freeBytes?: number; totalBytes?: number; error?: string };
  memory: { ok: boolean; freeBytes: number; totalBytes: number; rssBytes: number };
  uptime: { seconds: number };
  version: { value: string };
  docker: { value: boolean };
}

async function checkMongo(): Promise<HealthChecks["mongodb"]> {
  try {
    const result = await pingMongo();
    return { ok: true, latencyMs: result.latency_ms };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "MongoDB unavailable" };
  }
}

async function checkDisk(): Promise<HealthChecks["disk"]> {
  try {
    const stats = await statfs("/");
    return {
      ok: true,
      freeBytes: stats.bavail * stats.bsize,
      totalBytes: stats.blocks * stats.bsize,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Disk stats unavailable" };
  }
}

function checkMemory(): HealthChecks["memory"] {
  return {
    ok: true,
    freeBytes: os.freemem(),
    totalBytes: os.totalmem(),
    rssBytes: process.memoryUsage().rss,
  };
}

function checkDocker(): HealthChecks["docker"] {
  return { value: existsSync("/.dockerenv") };
}

export async function runHealthChecks(): Promise<HealthChecks> {
  const [mongodb, disk] = await Promise.all([checkMongo(), checkDisk()]);
  return {
    mongodb,
    disk,
    memory: checkMemory(),
    uptime: { seconds: Math.round(process.uptime()) },
    version: { value: apiConfig.version },
    docker: checkDocker(),
  };
}
