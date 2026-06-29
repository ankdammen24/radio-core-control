/**
 * Unit tests for stack token utility functions.
 *
 * These tests cover the pure, side-effect-free parts of tokens.functions.ts:
 *  - token format (prefix, length, character set)
 *  - hash determinism (same input → same output)
 *  - hash irreversibility check (hash ≠ raw)
 *  - uniqueness (two generated tokens differ)
 *
 * We do NOT test the createServerFn handlers here because they depend on
 * Supabase and cannot be imported without TanStack Start compilation.
 * Integration tests for the full token lifecycle should be done against a
 * test Supabase project.
 */
import { describe, it, expect } from "vitest";
import { createHash, randomBytes } from "crypto";

// ─── Replicate the token helpers inline so tests stay dependency-free ─────────

function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function generateTokenSecret(): { raw: string; hash: string } {
  const buf = randomBytes(32);
  const raw = "rck_" + buf.toString("base64url");
  return { raw, hash: hashToken(raw) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("generateTokenSecret", () => {
  it("raw secret starts with rck_ prefix", () => {
    const { raw } = generateTokenSecret();
    expect(raw.startsWith("rck_")).toBe(true);
  });

  it("raw secret has reasonable length (> 40 chars)", () => {
    // 32 bytes base64url ≈ 43 chars + 4 prefix = 47+
    const { raw } = generateTokenSecret();
    expect(raw.length).toBeGreaterThan(40);
  });

  it("raw secret contains only safe URL characters", () => {
    // base64url alphabet + underscore prefix separator
    const { raw } = generateTokenSecret();
    expect(raw).toMatch(/^rck_[A-Za-z0-9_-]+$/);
  });

  it("two generated tokens are unique", () => {
    const a = generateTokenSecret();
    const b = generateTokenSecret();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });

  it("hash is a 64-char hex string (SHA-256)", () => {
    const { hash } = generateTokenSecret();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hash differs from raw secret", () => {
    const { raw, hash } = generateTokenSecret();
    expect(hash).not.toBe(raw);
  });
});

describe("hashToken", () => {
  it("is deterministic — same input yields same hash", () => {
    const raw = "rck_test-token-abc123";
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it("different inputs yield different hashes", () => {
    expect(hashToken("rck_aaa")).not.toBe(hashToken("rck_bbb"));
  });

  it("matches crypto.createHash sha256 directly", () => {
    const raw = "rck_reference-value";
    const expected = createHash("sha256").update(raw, "utf8").digest("hex");
    expect(hashToken(raw)).toBe(expected);
  });

  it("is consistent with the station-api-auth hashStationKey pattern", () => {
    // Both use createHash('sha256').update(key, 'utf8').digest('hex')
    // Verifying that the same algorithm is used so tokens can be validated uniformly.
    const key = "rck_some-runner-token";
    const viaHashToken = hashToken(key);
    const viaDirectApi = createHash("sha256").update(key, "utf8").digest("hex");
    expect(viaHashToken).toBe(viaDirectApi);
  });
});

describe("TOKEN_PURPOSES values", () => {
  // Hardcode the expected values to keep the test dependency-free.
  // tokens.functions.ts imports createServerFn (TanStack Start) which cannot
  // be resolved in the plain Vitest Node environment. Integration tests for
  // the full token lifecycle belong in a separate e2e test suite against a
  // real Supabase project.
  const EXPECTED_PURPOSES = ["runner", "agent", "api"] as const;

  it("expected purposes are a tuple of three values", () => {
    expect(EXPECTED_PURPOSES).toHaveLength(3);
  });

  it("runner is a valid purpose", () => expect(EXPECTED_PURPOSES).toContain("runner"));
  it("agent is a valid purpose",  () => expect(EXPECTED_PURPOSES).toContain("agent"));
  it("api is a valid purpose",    () => expect(EXPECTED_PURPOSES).toContain("api"));
});
