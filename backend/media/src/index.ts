/**
 * Radio Core Media Server
 *
 * Hanterar uppladdning, leverans och hantering av mediafiler via Cloudflare R2.
 * Proxyas av nginx → api.radiouppsala.se/media-api/*
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

app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined"));

// ─── Health ────────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "radio-core-media",
    ts: new Date().toISOString(),
  });
});

// ─── Placeholder ──────────────────────────────────────────────────────────────

app.all("*", (_req, res) => {
  res.status(501).json({
    error: "Not implemented",
    hint: "Media routes byggs i backend/media/src/routes/",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[radio-core-media] Lyssnar på port ${PORT}`);
});
