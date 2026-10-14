import { describe, expect, it } from "@effect/vitest";
import { assertPublicResearchUrl } from "@repo/backend/confect/nina/research/tools/safety";
import { Effect, Result } from "effect";

describe("assertPublicResearchUrl", () => {
  it.effect("rejects unsafe URL syntax", () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(
        assertPublicResearchUrl("http://localhost:3000/admin")
      );
      expect(Result.isFailure(result)).toBe(true);
    })
  );

  it.effect("rejects a private IP literal and a malformed URL", () =>
    Effect.gen(function* () {
      const literal = yield* Effect.result(
        assertPublicResearchUrl("https://10.0.0.1/docs")
      );
      const malformed = yield* Effect.result(
        assertPublicResearchUrl("not a url")
      );
      expect(Result.isFailure(literal)).toBe(true);
      expect(Result.isFailure(malformed)).toBe(true);
    })
  );

  it.effect("keeps the native fetch of a public IP literal", () =>
    Effect.gen(function* () {
      const result = yield* assertPublicResearchUrl(
        "https://93.184.216.34/docs"
      );
      expect(result).toEqual({
        nativeFetchUrl: "https://93.184.216.34/docs",
        publicUrl: "https://93.184.216.34/docs",
      });
    })
  );

  // The .invalid top-level domain never resolves (RFC 6761), so a DNS lookup
  // of this host would fail and refuse the URL. The result must not depend on
  // any lookup, so the test would fail if one were made.
  it.effect("sends a host name to the provider alone, with no DNS lookup", () =>
    Effect.gen(function* () {
      const result = yield* assertPublicResearchUrl(
        "https://nakafa-missing.invalid/docs"
      );
      expect(result).toEqual({
        nativeFetchUrl: null,
        publicUrl: "https://nakafa-missing.invalid/docs",
      });
    })
  );

  it.effect("rejects IPv4-compatible IPv6 literals", () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(
        assertPublicResearchUrl("https://[::8.8.8.8]/")
      );
      expect(Result.isFailure(result)).toBe(true);
    })
  );
});
