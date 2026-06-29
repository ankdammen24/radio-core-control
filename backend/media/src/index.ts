/**
 * Radio Core Media Server — port 3001
 *
 * Hanterar uppladdning och leverans av mediafiler via Cloudflare R2.
 * Proxyas av nginx → api.radiouppsala.se/media-api/*
 *
 * Stora uppladdningar: client_max_body_size 500M sätts i nginx.conf.
 * Timeout: proxy_read_timeout 300s sätts i nginx.conf (matchar bodyParser limit).
 *
 * TODO:
 *   - Pre-signed upload URLs för direkt R2-uppladdning
 *   - Transkodning (ffmpeg) för format-konvertering
 *   - Artwork-resize via sharp
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const IS_PROD = process.env.NODE_ENV === "production";

const STUDIO_DOMAIN = process.env.STUDIO_DOMAIN ?? "studio.radiouppsala.se";

// ─── Trust proxy ──────────────────────────────────────────────────────────────
app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]);

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(
  cors({
    origin: [
      `https://${STUDIO_DOMAIN}`,
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    credentials: true,
  }),
);

// ─── Body parser — stöd stora uppladdningar ───────────────────────────────────
// Nginx tillåter 500M (client_max_body_size); sätt samma här.
// För riktigt stora filer: använd streaming/multipart istället.
app.use(express.json({ limit: "500mb" }));
app.use(express.raw({ type: "audio/*", limit: "500mb" }));
app.use(express.raw({ type: "video/*", limit: "500mb" }));
app.use(morgan(IS_PROD ? "combined" : "dev"));

// ─── Health ───────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.send("OK");
});

app.get("/api/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    ok: true,
    service: "radio-core-media",
    version: process.env.npm_package_version ?? "0.1.0",
    env: process.env.NODE_ENV ?? "unknown",
    ts: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    r2: {
      bucket: process.env.R2_BUCKET ?? "(ej konfigurerad)",
      configured: Boolean(process.env.R2_ACCESS_KEY),
    },
  });
});

// ─── Upload placeholder ───────────────────────────────────────────────────────
// nginx skickar /media-api/* hit som /* (strip prefix via nginx location /media-api/)

app.post("/upload", (_req, res) => {
  // TODO: ta emot multipart, ladda upp till R2, returnera publicUrl
  res.status(501).json({
    error: "Not implemented",
    hint: "Implementera multipart-upload med @aws-sdk/client-s3",
  });
});

app.get("/presigned-url", (_req, res) => {
  // TODO: returnera pre-signed R2 URL för direktuppladdning från frontend
  res.status(501).json({
    error: "Not implemented",
    hint: "Implementera pre-signed URL med @aws-sdk/s3-request-presigner",
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.all("*", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[radio-core-media]", err);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[radio-core-media] Lyssnar på 0.0.0.0:${PORT} (${process.env.NODE_ENV ?? "development"})`);
});
