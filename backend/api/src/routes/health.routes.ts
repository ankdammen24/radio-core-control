import { Router } from "express";
import { runHealthChecks } from "../core/health-check.js";
import { asyncHandler } from "../utils/async-handler.js";

export const healthRouter = Router();

// Kept flat (no success/data envelope) and at its established path —
// Docker healthcheck and nginx both depend on this exact contract.
healthRouter.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(200).json({ status: "ok", service: "radio-core-api" });
});

// Same established top-level shape (status/service/database), extended
// additively with a `checks` object covering disk/memory/uptime/version/docker.
healthRouter.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    const checks = await runHealthChecks();
    res.set("Cache-Control", "no-store");
    res.status(200).json({
      status: "ok",
      service: "radio-core-api",
      database: checks.mongodb.ok ? "connected" : "not_connected",
      checks,
    });
  }),
);
