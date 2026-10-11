import { describe, expect, it } from "@effect/vitest";
import { searchFirecrawl } from "@repo/backend/confect/nina/research/search/provider";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

const firecrawlApp = vi.hoisted(() => ({ search: vi.fn() }));

vi.mock("@repo/backend/confect/nina/research/provider", () => ({
  readFirecrawlApp: () => Effect.succeed(firecrawlApp),
}));

describe("searchFirecrawl", () => {
  it.effect(
    "keeps the provider's status and never its message, which may repeat the query",
    () =>
      Effect.gen(function* () {
        firecrawlApp.search.mockRejectedValueOnce(
          Object.assign(new Error("Unauthorized for query kurikulum merdeka"), {
            status: 401,
          })
        );
        const error = yield* Effect.flip(searchFirecrawl("kurikulum merdeka"));
        expect(error).toMatchObject({
          _tag: "ResearchSearchError",
          message: "Failed to search the web. Please try again.",
          status: 401,
        });
        expect(encodeJsonText({ ...error })).not.toContain("Unauthorized");
      })
  );

  it.effect(
    "asks for results only, so the provider reads no page inside the search",
    () =>
      Effect.gen(function* () {
        firecrawlApp.search.mockResolvedValueOnce({ web: [] });
        yield* searchFirecrawl("kurikulum merdeka");
        expect(firecrawlApp.search).toHaveBeenLastCalledWith(
          "kurikulum merdeka",
          { limit: 5, sources: ["web", "news"], timeout: 10_000 }
        );
      })
  );

  it.effect("has no status when the provider never answered", () =>
    Effect.gen(function* () {
      firecrawlApp.search.mockRejectedValueOnce(new Error("socket hang up"));
      const error = yield* Effect.flip(searchFirecrawl("kurikulum merdeka"));
      expect(error.status).toBeUndefined();
    })
  );

  it.effect(
    "settles a query the provider never answers as a failed search",
    () =>
      Effect.gen(function* () {
        firecrawlApp.search.mockReturnValueOnce(new Promise(() => undefined));
        const fiber = yield* Effect.forkChild(
          Effect.flip(searchFirecrawl("kurikulum merdeka"))
        );
        yield* TestClock.adjust("11999 millis");
        expect(fiber.pollUnsafe()).toBeUndefined();
        yield* TestClock.adjust("1 millis");
        const error = yield* Fiber.join(fiber);
        expect(error).toMatchObject({
          _tag: "ResearchSearchError",
          message: "Failed to search the web. Please try again.",
        });
        expect(error.status).toBeUndefined();
      })
  );
  it.effect(
    "asks once more, a second later, when the plan's rate limit refuses a search",
    () =>
      Effect.gen(function* () {
        const refused = Object.assign(new Error("Rate limit"), { status: 429 });
        firecrawlApp.search.mockClear();
        firecrawlApp.search
          .mockRejectedValueOnce(refused)
          .mockResolvedValueOnce({ web: [] });
        const fiber = yield* Effect.forkChild(
          searchFirecrawl("kurikulum merdeka")
        );
        yield* TestClock.adjust("999 millis");
        expect(firecrawlApp.search).toHaveBeenCalledTimes(1);
        yield* TestClock.adjust("1 millis");
        expect(yield* Fiber.join(fiber)).toEqual({
          query: "kurikulum merdeka",
          response: { web: [] },
        });
        expect(firecrawlApp.search).toHaveBeenCalledTimes(2);
      })
  );

  it.effect(
    "fails after the second refusal, and never asks again for any other failure",
    () =>
      Effect.gen(function* () {
        const refused = Object.assign(new Error("Rate limit"), { status: 429 });
        firecrawlApp.search.mockClear();
        firecrawlApp.search
          .mockRejectedValueOnce(refused)
          .mockRejectedValueOnce(refused);
        const fiber = yield* Effect.forkChild(
          Effect.flip(searchFirecrawl("kurikulum merdeka"))
        );
        yield* TestClock.adjust("1 second");
        expect((yield* Fiber.join(fiber)).status).toBe(429);
        expect(firecrawlApp.search).toHaveBeenCalledTimes(2);

        firecrawlApp.search.mockClear();
        firecrawlApp.search.mockRejectedValueOnce(
          Object.assign(new Error("Unauthorized"), { status: 401 })
        );
        yield* Effect.flip(searchFirecrawl("kurikulum merdeka"));
        expect(firecrawlApp.search).toHaveBeenCalledTimes(1);
      })
  );
});
