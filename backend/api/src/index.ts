import express from "express";
import { closeMongo, pingMongo } from "./database/mongo.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");

app.get("/health", (_request, response) => {
  response.set("Cache-Control", "no-store");
  response.status(200).json({ ok: true, service: "radio-core-api" });
});

app.get("/api/health", async (_request, response) => {
  let mongodb: { ok: boolean; latency_ms?: number; error?: string };
  try {
    mongodb = await pingMongo();
  } catch (error) {
    mongodb = {
      ok: false,
      error: error instanceof Error ? error.message : "MongoDB unavailable",
    };
  }

  response.set("Cache-Control", "no-store");
  response.status(200).json({
    ok: true,
    service: "radio-core-api",
    version: process.env.npm_package_version ?? "0.1.0",
    environment: process.env.NODE_ENV ?? "development",
    public_url: process.env.API_PUBLIC_URL ?? null,
    timestamp: new Date().toISOString(),
    dependencies: { mongodb },
  });
});

app.use((_request, response) => {
  response.status(404).json({ error: "Not found" });
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`[radio-core-api] listening on 0.0.0.0:${port}`);
  void pingMongo()
    .then(() => console.log("[radio-core-api] MongoDB connected"))
    .catch((error) => console.warn(`[radio-core-api] MongoDB unavailable: ${error.message}`));
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => void closeMongo().finally(() => process.exit(0)));
  });
}
