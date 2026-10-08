import { beforeEach, describe, expect, it } from "@effect/vitest";
import { assertPublicResearchUrl } from "@repo/backend/confect/nina/research/tools/safety";
import { Effect, Result } from "effect";

const lookup = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({
  lookup,
}));
describe("assertPublicResearchUrl", () => {
  beforeEach(() => {
    lookup.mockReset();
  });
  it.effect("rejects unsafe URL syntax before DNS lookup", () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(
        assertPublicResearchUrl("http://localhost:3000/admin")
      );
      expect(Result.isFailure(result)).toBe(true);
      expect(lookup).not.toHaveBeenCalled();
    })
  );
  it.effect("allows public IP literals without DNS lookup", () =>
    Effect.gen(function* () {
      const result = yield* assertPublicResearchUrl(
        "https://93.184.216.34/docs"
      );
      expect(result).toEqual({
        nativeFetchUrl: "https://93.184.216.34/docs",
        publicUrl: "https://93.184.216.34/docs",
      });
      expect(lookup).not.toHaveBeenCalled();
    })
  );
  it.effect("rejects hostnames when DNS resolution fails", () =>
    Effect.gen(function* () {
      lookup.mockRejectedValue(new Error("DNS failure"));
      const result = yield* Effect.result(
        assertPublicResearchUrl("https://example.com/docs")
      );
      expect(Result.isFailure(result)).toBe(true);
    })
  );
  it.effect("rejects hostnames without DNS addresses", () =>
    Effect.gen(function* () {
      lookup.mockResolvedValue([]);
      const result = yield* Effect.result(
        assertPublicResearchUrl("https://example.com/docs")
      );
      expect(Result.isFailure(result)).toBe(true);
    })
  );
  it.effect("rejects hostnames that resolve to private addresses", () =>
    Effect.gen(function* () {
      lookup.mockResolvedValue([{ address: "10.0.0.1", family: 4 }]);
      const result = yield* Effect.result(
        assertPublicResearchUrl("https://example.com/docs")
      );
      expect(Result.isFailure(result)).toBe(true);
    })
  );
  it.effect(
    "allows public hostnames without enabling native server fetches",
    () =>
      Effect.gen(function* () {
        lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
        const result = yield* assertPublicResearchUrl(
          "https://example.com/docs"
        );
        expect(result).toEqual({
          nativeFetchUrl: null,
          publicUrl: "https://example.com/docs",
        });
      })
  );
  it.effect("rejects hostnames when an answer carries a zone suffix", () =>
    Effect.gen(function* () {
      lookup.mockResolvedValue([{ address: "fe80::1%eth0", family: 6 }]);
      const result = yield* Effect.result(
        assertPublicResearchUrl("https://example.com/docs")
      );
      expect(Result.isFailure(result)).toBe(true);
    })
  );
  it.effect("rejects hostnames when one of several answers is refused", () =>
    Effect.gen(function* () {
      lookup.mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ]);
      const result = yield* Effect.result(
        assertPublicResearchUrl("https://example.com/docs")
      );
      expect(Result.isFailure(result)).toBe(true);
    })
  );
  it.effect(
    "allows hostnames when every one of several answers is public",
    () =>
      Effect.gen(function* () {
        lookup.mockResolvedValue([
          { address: "93.184.216.34", family: 4 },
          { address: "2606:4700:4700::1111", family: 6 },
        ]);
        const result = yield* assertPublicResearchUrl(
          "https://example.com/docs"
        );
        expect(result).toEqual({
          nativeFetchUrl: null,
          publicUrl: "https://example.com/docs",
        });
      })
  );
  it.effect("rejects IPv4-compatible IPv6 literals before DNS lookup", () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(
        assertPublicResearchUrl("https://[::8.8.8.8]/")
      );
      expect(Result.isFailure(result)).toBe(true);
      expect(lookup).not.toHaveBeenCalled();
    })
  );
});
