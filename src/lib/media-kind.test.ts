import { describe, it, expect } from "vitest";
import {
  parseMediaKind,
  parseMediaKindStrict,
  isMediaKind,
  MEDIA_KINDS,
} from "@/lib/media-kind";

describe("parseMediaKind", () => {
  it("accepts every canonical media kind", () => {
    for (const k of MEDIA_KINDS) {
      expect(parseMediaKind(k)).toBe(k);
      expect(isMediaKind(k)).toBe(true);
    }
  });

  it("falls back to music for unknown / missing / non-string values", () => {
    expect(parseMediaKind(undefined)).toBe("music");
    expect(parseMediaKind(null)).toBe("music");
    expect(parseMediaKind("")).toBe("music");
    expect(parseMediaKind("songs")).toBe("music");
    expect(parseMediaKind(42)).toBe("music");
    expect(parseMediaKind({ media_kind: "jingle" })).toBe("music");
  });

  it("respects an explicit fallback", () => {
    expect(parseMediaKind(undefined, "jingle")).toBe("jingle");
    expect(parseMediaKind("nope", "fx")).toBe("fx");
  });

  it("does not coerce close-but-wrong strings (case / whitespace)", () => {
    expect(parseMediaKind("Music")).toBe("music"); // wrong case → fallback
    expect(parseMediaKind(" music ")).toBe("music"); // padded → fallback
    expect(parseMediaKind("MUSIC")).toBe("music");
  });

  it("strict variant throws on invalid input", () => {
    expect(() => parseMediaKindStrict("songs")).toThrow(/Invalid media_kind/);
    expect(() => parseMediaKindStrict(undefined)).toThrow(/Invalid media_kind/);
    expect(parseMediaKindStrict("promo")).toBe("promo");
  });
});
