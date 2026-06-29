/**
 * Radio Core API — Express server
 *
 * Entry point för backend-API-tjänsten.
 * Körs i Docker via radio-core-api-container (port 3000).
 * Proxyas av nginx → api.radiouppsala.se/api/*
 *
 * TODO: importera och montera routes när de byggs:
 *   app.use('/api/stations', stationsRouter)
 *   app.use('/api/tokens',   tokensRouter)
 *   app.use('/auth',         authRouter)
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────

// Lita på Cloudflare + nginx proxy-headers
app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]);

app.use(
  helmet({
    contentSecurityPolicy: false, // Hanteras av Cloudflare
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin: [
      `https://${process.env.STUDIO_DOMAIN ?? "studio.radiouppsala.se"}`,
      "http://localhost:3000",
    ],
    credentials: true,
  }),
);

app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined"));

// ─── Health ────────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "radio-core-api",
    version: process.env.npm_package_version ?? "0.1.0",
    env: process.env.NODE_ENV ?? "unknown",
    ts: new Date().toISOString(),
  });
});

// ─── Placeholder routes ────────────────────────────────────────────────────────
// TODO: Flytta TanStack Start-serverFunctions hit när backend separeras

app.all("/api/*", (_req, res) => {
  res.status(501).json({
    error: "Not implemented",
    hint: "API routes byggs i backend/api/src/routes/",
  });
});

app.all("/auth/*", (_req, res) => {
  res.status(501).json({
    error: "Not implemented",
    hint: "Auth routes byggs i backend/api/src/routes/auth/",
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[radio-core-api]", err);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[radio-core-api] Lyssnar på port ${PORT} (${process.env.NODE_ENV ?? "development"})`);
});
