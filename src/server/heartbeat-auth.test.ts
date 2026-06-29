/**
 * Unit tests for heartbeat endpoint auth and validation logic.
 *
 * These tests cover the pure helper functions extracted from the heartbeat
 * route. The actual route handler depends on Supabase and TanStack Start and
 * cannot be tested in the plain Vitest Node environment — those require an
 * integration test suite with a real Supabase project.
 *
 * The functions tested here are inlined (matching the implementation in
 * api.public.agent.heartbeat.ts) so tests remain dependency-free.
 */
import { describe, it, expect } from "vitest";
import { createHash } from "crypto";

// ─── Inline helpers (must match api.public.agent.heartbeat.ts) ────────────────

function safeString(v: unknown, max = 255): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  return v.trim().slice(0, max);
}

function safeObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

// Simulate the purpose check performed in the route handler
function isAllowedPurpose(purpose: string): boolean {
  return purpose === "runner" || purpose === "agent";
}

// ─── Token hash ────────────────────────────────────────────────────────────────

describe("hashToken (heartbeat)", () => {
  it("produces a 64-char hex string", () => {
    expect(hashToken("rck_test")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    const raw = "rck_abc123";
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it("differs for different inputs", () => {
    expect(hashToken("rck_aaa")).not.toBe(hashToken("rck_bbb"));
  });
});

// ─── Purpose check ─────────────────────────────────────────────────────────────

describe("isAllowedPurpose", () => {
  it("allows runner", () => expect(isAllowedPurpose("runner")).toBe(true));
  it("allows agent",  () => expect(isAllowedPurpose("agent")).toBe(true));
  it("rejects api",   () => expect(isAllowedPurpose("api")).toBe(false));
  it("rejects empty", () => expect(isAllowedPurpose("")).toBe(false));
  it("rejects arbitrary string", () => expect(isAllowedPurpose("admin")).toBe(false));
});

// ─── UUID validation ──────────────────────────────────────────────────────────

describe("isUuid", () => {
  it("accepts a valid v4 UUID", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("accepts uppercase UUID", () => {
    expect(isUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("radio-agent-01")).toBe(false);
    expect(isUuid("")).toBe(false);
  });

  it("rejects non-string types", () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid({})).toBe(false);
  });
});

// ─── safeString ──────────────────────────────────────────────────────────────

describe("safeString", () => {
  it("returns null for non-strings", () => {
    expect(safeString(null)).toBeNull();
    expect(safeString(undefined)).toBeNull();
    expect(safeString(42)).toBeNull();
    expect(safeString({})).toBeNull();
  });

  it("returns null for empty / whitespace-only strings", () => {
    expect(safeString("")).toBeNull();
    expect(safeString("   ")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(safeString("  hello  ")).toBe("hello");
  });

  it("truncates to max length", () => {
    const long = "a".repeat(300);
    expect(safeString(long, 255)!.length).toBe(255);
    expect(safeString(long, 50)!.length).toBe(50);
  });

  it("returns the value when valid", () => {
    expect(safeString("radio-uppsala")).toBe("radio-uppsala");
  });
});

// ─── safeObject ──────────────────────────────────────────────────────────────

describe("safeObject", () => {
  it("returns the object when valid", () => {
    const obj = { liquidsoap: true, icecast: false };
    expect(safeObject(obj)).toEqual(obj);
  });

  it("returns empty object for non-objects", () => {
    expect(safeObject(null)).toEqual({});
    expect(safeObject(undefined)).toEqual({});
    expect(safeObject("string")).toEqual({});
    expect(safeObject(42)).toEqual({});
  });

  it("returns empty object for arrays (not plain objects)", () => {
    expect(safeObject([1, 2, 3])).toEqual({});
  });

  it("preserves nested objects", () => {
    const m = { cpu: 0.12, memory_mb: 512, disk_free_mb: 20480 };
    expect(safeObject(m)).toEqual(m);
  });
});

// ─── Simulated auth decision table ───────────────────────────────────────────

describe("heartbeat auth decision logic", () => {
  type FakeToken = { is_active: boolean; purpose: string } | null;

  function decide(tok: FakeToken): "ok" | "missing" | "revoked" | "wrong_purpose" {
    if (!tok) return "missing";
    if (!tok.is_active) return "revoked";
    if (!isAllowedPurpose(tok.purpose)) return "wrong_purpose";
    return "ok";
  }

  it("missing token → missing", () => {
    expect(decide(null)).toBe("missing");
  });

  it("inactive token → revoked", () => {
    expect(decide({ is_active: false, purpose: "runner" })).toBe("revoked");
  });

  it("wrong purpose (api) → wrong_purpose", () => {
    expect(decide({ is_active: true, purpose: "api" })).toBe("wrong_purpose");
  });

  it("active runner token → ok", () => {
    expect(decide({ is_active: true, purpose: "runner" })).toBe("ok");
  });

  it("active agent token → ok", () => {
    expect(decide({ is_active: true, purpose: "agent" })).toBe("ok");
  });
});
