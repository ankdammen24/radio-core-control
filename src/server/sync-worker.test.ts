import { describe, it, expect } from "vitest";
import {
  SyncWorkerError,
  firstAppStackFrame,
  requireTargetForSeparatedBuckets,
  resolveStorageTargetCredentials,
  type StorageTargetRow,
} from "@/server/sync-worker.server";

function makeEnv(values: Record<string, string | undefined>) {
  return (name: string, fallback?: string) =>
    values[name] ?? fallback ?? undefined;
}

const baseTarget: StorageTargetRow = {
  id: "tgt-1",
  bucket: "bucket-music",
  endpoint_url: "https://s3.example.com",
  region: "eu-central-1",
  access_key_ref: "MY_ACCESS_KEY",
  secret_key_ref: "MY_SECRET_KEY",
};

describe("requireTargetForSeparatedBuckets", () => {
  it("allows music without an explicit target_id", () => {
    expect(() => requireTargetForSeparatedBuckets(undefined, "music")).not.toThrow();
    expect(() => requireTargetForSeparatedBuckets(null, "music")).not.toThrow();
  });

  it("requires a string target_id for non-music kinds", () => {
    for (const k of ["jingle", "sweeper", "promo", "fx"] as const) {
      expect(() => requireTargetForSeparatedBuckets(undefined, k)).toThrow(
        new RegExp(`target_id is required when media_kind is "${k}"`),
      );
      expect(() => requireTargetForSeparatedBuckets(null, k)).toThrow();
      expect(() => requireTargetForSeparatedBuckets(123, k)).toThrow();
      expect(() => requireTargetForSeparatedBuckets("tgt-1", k)).not.toThrow();
    }
  });
});

describe("resolveStorageTargetCredentials", () => {
  it("resolves credentials from secret refs on the target row", () => {
    const env = makeEnv({
      MY_ACCESS_KEY: "AKIA-row",
      MY_SECRET_KEY: "secret-row",
    });
    const r = resolveStorageTargetCredentials(baseTarget, "music", env);
    expect(r.endpoint).toBe("https://s3.example.com");
    expect(r.region).toBe("eu-central-1");
    expect(r.accessKeyId).toBe("AKIA-row");
    expect(r.secretAccessKey).toBe("secret-row");
    expect(r.context).toMatchObject({
      target_id: "tgt-1",
      bucket: "bucket-music",
      access_key_ref: "MY_ACCESS_KEY",
      secret_key_ref: "MY_SECRET_KEY",
      has_access_key: true,
      has_secret_key: true,
      mediaKind: "music",
    });
  });

  it("falls back to S3_* env vars when target has no refs / endpoint / region", () => {
    const env = makeEnv({
      S3_ENDPOINT: "https://fallback.example",
      S3_ACCESS_KEY_ID: "AKIA-fallback",
      S3_SECRET_ACCESS_KEY: "secret-fallback",
    });
    const r = resolveStorageTargetCredentials(
      {
        ...baseTarget,
        endpoint_url: null,
        region: null,
        access_key_ref: null,
        secret_key_ref: null,
      },
      "jingle",
      env,
    );
    expect(r.endpoint).toBe("https://fallback.example");
    expect(r.region).toBe("auto");
    expect(r.accessKeyId).toBe("AKIA-fallback");
    expect(r.secretAccessKey).toBe("secret-fallback");
    expect(r.context.has_access_key).toBe(true);
    expect(r.context.access_key_ref).toBeNull();
    expect(r.context.mediaKind).toBe("jingle");
  });

  it("falls back to S3_* env vars when the referenced secret is missing", () => {
    const env = makeEnv({
      S3_ACCESS_KEY_ID: "AKIA-fallback",
      S3_SECRET_ACCESS_KEY: "secret-fallback",
    });
    const r = resolveStorageTargetCredentials(baseTarget, "music", env);
    // refs exist on the row but envReader returns undefined for them
    expect(r.accessKeyId).toBe("AKIA-fallback");
    expect(r.secretAccessKey).toBe("secret-fallback");
  });

  it("throws SyncWorkerError with context when endpoint is missing", () => {
    const env = makeEnv({
      MY_ACCESS_KEY: "AKIA",
      MY_SECRET_KEY: "secret",
    });
    const t: StorageTargetRow = { ...baseTarget, endpoint_url: null };
    try {
      resolveStorageTargetCredentials(t, "music", env);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(SyncWorkerError);
      const err = e as SyncWorkerError;
      expect(err.message).toMatch(/credentials missing/i);
      expect(err.context).toMatchObject({
        target_id: "tgt-1",
        bucket: "bucket-music",
        endpoint: undefined,
        has_access_key: true,
        has_secret_key: true,
      });
    }
  });

  it("throws when access key cannot be resolved from any source", () => {
    const env = makeEnv({ MY_SECRET_KEY: "secret" });
    expect(() =>
      resolveStorageTargetCredentials(baseTarget, "music", env),
    ).toThrow(SyncWorkerError);
  });

  it("throws when secret key cannot be resolved from any source", () => {
    const env = makeEnv({ MY_ACCESS_KEY: "AKIA" });
    try {
      resolveStorageTargetCredentials(baseTarget, "fx", env);
      throw new Error("expected throw");
    } catch (e) {
      const err = e as SyncWorkerError;
      expect(err).toBeInstanceOf(SyncWorkerError);
      expect(err.context.has_access_key).toBe(true);
      expect(err.context.has_secret_key).toBe(false);
      expect(err.context.mediaKind).toBe("fx");
    }
  });

  it("never leaks raw credential values into the error context", () => {
    const env = makeEnv({ MY_ACCESS_KEY: "AKIA-row" }); // missing secret
    try {
      resolveStorageTargetCredentials(baseTarget, "music", env);
    } catch (e) {
      const err = e as SyncWorkerError;
      const serialized = JSON.stringify(err.context);
      expect(serialized).not.toContain("AKIA-row");
      expect(serialized).not.toContain("secret-row");
    }
  });
});

describe("SyncWorkerError", () => {
  it("carries context and optional cause", () => {
    const cause = new Error("boom");
    const err = new SyncWorkerError("nope", { target_id: "x" }, cause);
    expect(err.name).toBe("SyncWorkerError");
    expect(err.message).toBe("nope");
    expect(err.context).toEqual({ target_id: "x" });
    expect(err.cause).toBe(cause);
  });
});

describe("firstAppStackFrame", () => {
  it("returns undefined for empty stacks", () => {
    expect(firstAppStackFrame(undefined)).toBeUndefined();
    expect(firstAppStackFrame("")).toBeUndefined();
  });

  it("prefers frames inside /src/server/ or sync-worker", () => {
    const stack = [
      "Error: x",
      "    at Object.<anonymous> (/node_modules/foo/index.js:1:1)",
      "    at runHandler (/app/src/server/sync-worker.server.ts:42:7)",
      "    at run (/node_modules/bar/index.js:9:9)",
    ].join("\n");
    expect(firstAppStackFrame(stack)).toContain("sync-worker.server.ts:42:7");
  });

  it("falls back to topmost frame when no app frame is present", () => {
    const stack = [
      "Error: x",
      "    at Object.foo (/node_modules/foo/index.js:1:1)",
      "    at Object.bar (/node_modules/bar/index.js:2:2)",
    ].join("\n");
    expect(firstAppStackFrame(stack)).toContain("/node_modules/foo/index.js:1:1");
  });
});
