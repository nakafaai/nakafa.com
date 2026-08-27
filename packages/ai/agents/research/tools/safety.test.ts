import { beforeEach, describe, expect, it } from "@effect/vitest";
import { assertPublicResearchUrl } from "@repo/ai/agents/research/tools/safety";
import { Effect, Result } from "effect";
import { vi } from "vitest";

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
});
