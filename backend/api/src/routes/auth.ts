/**
 * Auth routes — /auth/*
 *
 * Hanterar session-baserad autentisering med httpOnly-cookies.
 *
 * Cookie-strategi för Cloudflare + Vercel:
 *   - Secure: true i prod (HTTPS obligatoriskt)
 *   - SameSite: "none" i prod — krävs för cross-domain:
 *       frontend: studio.radiouppsala.se (Vercel)
 *       backend:  api.radiouppsala.se (Docker/VPS)
 *   - Domain: .radiouppsala.se (delas mellan subdomäner)
 *   - HttpOnly: true (ej åtkomlig från JS — skydd mot XSS)
 *
 * TODO:
 *   - POST /auth/login    — validera email+password mot users-tabell
 *   - POST /auth/logout   — rensa session-cookie
 *   - GET  /auth/me       — returnera inloggad användare från cookie
 *   - POST /auth/refresh  — förnya JWT
 */

import { Router } from "express";
import { COOKIE_DEFAULTS } from "../index.js";

const router = Router();
const SESSION_COOKIE = "rc_session";

// POST /auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "email och password krävs" });
  }

  // TODO: validera mot users-tabell med bcrypt
  // const user = await db.select().from(users).where(eq(users.email, email)).limit(1)
  // if (!user || !bcrypt.compareSync(password, user.passwordHash)) { ... }

  // Placeholder — accepterar alla i dev
  if (process.env.NODE_ENV !== "production") {
    const devToken = "dev-session-token";
    res.cookie(SESSION_COOKIE, devToken, {
      ...COOKIE_DEFAULTS,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dagar
    });
    return res.json({
      ok: true,
      user: { id: "dev-user", email, role: "admin" },
    });
  }

  return res.status(501).json({ error: "Login ej implementerad i produktion än" });
});

// POST /auth/logout
router.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, {
    ...COOKIE_DEFAULTS,
    maxAge: 0,
  });
  res.json({ ok: true });
});

// GET /auth/me
router.get("/me", (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    return res.status(401).json({ error: "Ej inloggad" });
  }

  // TODO: verifiera JWT/session-token, hämta användare från DB
  if (process.env.NODE_ENV !== "production") {
    return res.json({
      id: "dev-user",
      email: "dev@radio-core.local",
      role: "admin",
    });
  }

  return res.status(501).json({ error: "Session-verifiering ej implementerad" });
});

export default router;
