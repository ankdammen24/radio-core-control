/**
 * Radio Core API — Express server
 *
 * Port 3000 (intern Docker). Exponeras via nginx → api.radiouppsala.se
 *
 * Proxy-kedja: Cloudflare → nginx → radio-core-api:3000
 * Trust proxy: loopback + linklocal + uniquelocal (nginx på samma Docker-nätverk)
 *
 * CORS: tillåter studio.radiouppsala.se (Vercel) och localhost i dev.
 *
 * Cookies (cross-domain Vercel ↔ API):
 *   Produktion: Secure=true, SameSite=None, Domain=.radiouppsala.se
 *   Dev:        Secure=false, SameSite=Lax
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === "production";

const STUDIO_DOMAIN = process.env.STUDIO_DOMAIN ?? "studio.radiouppsala.se";
const API_DOMAIN    = process.env.API_DOMAIN    ?? "api.radiouppsala.se";

// ─── Trust proxy ──────────────────────────────────────────────────────────────
// nginx körs på samma Docker-nätverk. req.ip / req.secure / req.protocol
// sätts korrekt från X-Forwarded-For / X-Forwarded-Proto.
app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]);

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  `https://${STUDIO_DOMAIN}`,
  `https://${API_DOMAIN}`,
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: blockad origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Stack-Token",
      "X-Request-ID",
      "X-Api-Key",
    ],
    maxAge: 86400,
  }),
);

// ─── Body + middleware ────────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(morgan(IS_PROD ? "combined" : "dev"));

// ─── Cookie defaults (exporteras till routes) ─────────────────────────────────
export const COOKIE_DEFAULTS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: (IS_PROD ? "none" : "lax") as "none" | "lax",
  // SameSite=None: krävs för cross-domain Vercel (studio.) ↔ API (api.)
  // SameSite=Lax: fungerar för localhost ↔ localhost i dev utan Secure
  domain: IS_PROD ? ".radiouppsala.se" : undefined,
  path: "/",
};

// ─── Health endpoints ─────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.send("OK");
});

app.get("/api/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    ok: true,
    service: "radio-core-api",
    version: process.env.npm_package_version ?? "0.1.0",
    env: process.env.NODE_ENV ?? "unknown",
    ts: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
// Auth importeras dynamiskt för att undvika ESM-cirkelberoenden under init
import authRouter from "./routes/auth.js";
app.use("/auth", authRouter);

// Placeholder — ersätts med faktiska routers:
//   import stationsRouter from "./routes/stations.js";
//   app.use("/api/stations", stationsRouter);

app.all("/api/*", (_req, res) => {
  res.status(501).json({
    error: "Not implemented",
    hint: "API-routes byggs i backend/api/src/routes/",
  });
});

// ─── 404 + error handler ──────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[radio-core-api]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[radio-core-api] 0.0.0.0:${PORT} (${process.env.NODE_ENV ?? "development"})`);
  console.log(`[radio-core-api] CORS: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`[radio-core-api] Cookies: secure=${IS_PROD}, sameSite=${IS_PROD ? "none" : "lax"}`);
});
