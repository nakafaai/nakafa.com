import { assertPublicResearchUrl } from "@repo/ai/agents/research/tools/safety";
import { Effect, Either } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const lookup = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({
  lookup,
}));

describe("assertPublicResearchUrl", () => {
  beforeEach(() => {
    lookup.mockReset();
  });

  it("rejects unsafe URL syntax before DNS lookup", async () => {
    const result = await Effect.runPromise(
      Effect.either(assertPublicResearchUrl("http://localhost:3000/admin"))
    );

    expect(Either.isLeft(result)).toBe(true);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("allows public IP literals without DNS lookup", async () => {
    const result = await Effect.runPromise(
      assertPublicResearchUrl("https://93.184.216.34/docs")
    );

    expect(result).toEqual({
      nativeFetchUrl: "https://93.184.216.34/docs",
      publicUrl: "https://93.184.216.34/docs",
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects hostnames when DNS resolution fails", async () => {
    lookup.mockRejectedValue(new Error("DNS failure"));

    const result = await Effect.runPromise(
      Effect.either(assertPublicResearchUrl("https://example.com/docs"))
    );

    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects hostnames without DNS addresses", async () => {
    lookup.mockResolvedValue([]);

    const result = await Effect.runPromise(
      Effect.either(assertPublicResearchUrl("https://example.com/docs"))
    );

    expect(Either.isLeft(result)).toBe(true);
  });

  it("rejects hostnames that resolve to private addresses", async () => {
    lookup.mockResolvedValue([{ address: "10.0.0.1", family: 4 }]);

    const result = await Effect.runPromise(
      Effect.either(assertPublicResearchUrl("https://example.com/docs"))
    );

    expect(Either.isLeft(result)).toBe(true);
  });

  it("allows public hostnames without enabling native server fetches", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

    const result = await Effect.runPromise(
      assertPublicResearchUrl("https://example.com/docs")
    );

    expect(result).toEqual({
      nativeFetchUrl: null,
      publicUrl: "https://example.com/docs",
    });
  });
});
