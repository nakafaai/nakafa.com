import { describe, expect, it } from "@effect/vitest";
import { CapabilityDeadline } from "@repo/backend/confect/nina/capability/deadline";
import { searchFirecrawl } from "@repo/backend/confect/nina/research/search/provider";
import { withTimeLeft } from "@repo/backend/test/nina/deadline";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Duration, Effect, Fiber, Ref } from "effect";
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

  it.effect(
    "restricts the search to the sites it is given through the provider's own includeDomains field, exactly as given",
    () =>
      Effect.gen(function* () {
        firecrawlApp.search.mockClear();
        firecrawlApp.search.mockResolvedValueOnce({ web: [] });
        yield* searchFirecrawl("kurikulum merdeka", [
          "snpmb.bppp.kemdikbud.go.id",
          "bbc.com",
        ]);
        expect(firecrawlApp.search).toHaveBeenLastCalledWith(
          "kurikulum merdeka",
          {
            limit: 5,
            sources: ["web", "news"],
            timeout: 10_000,
            includeDomains: ["snpmb.bppp.kemdikbud.go.id", "bbc.com"],
          }
        );
      })
  );

  it.effect.each([
    { sites: undefined, text: "no site" },
    { sites: [], text: "an empty list of sites" },
  ])(
    "sends no includeDomains field for $text, because the SDK would send an empty list to the provider as it is",
    ({ sites }) =>
      Effect.gen(function* () {
        firecrawlApp.search.mockClear();
        firecrawlApp.search.mockResolvedValueOnce({ web: [] });
        yield* searchFirecrawl("kurikulum merdeka", sites);
        const [, options] = firecrawlApp.search.mock.calls[0] ?? [];
        expect(options).toEqual({
          limit: 5,
          sources: ["web", "news"],
          timeout: 10_000,
        });
        expect(options).not.toHaveProperty("includeDomains");
      })
  );

  it.effect(
    "asks again with the same sites when the rate limit refuses a restricted search, so a retry never widens it",
    () =>
      Effect.gen(function* () {
        firecrawlApp.search.mockClear();
        firecrawlApp.search
          .mockRejectedValueOnce(
            Object.assign(new Error("Rate limit"), { status: 429 })
          )
          .mockResolvedValueOnce({ web: [] });
        const fiber = yield* Effect.forkChild(
          searchFirecrawl("kurikulum merdeka", ["bbc.com"])
        );
        yield* TestClock.adjust("1 second");
        yield* Fiber.join(fiber);
        expect(
          Arr.map(
            firecrawlApp.search.mock.calls,
            ([, options]) => options.includeDomains
          )
        ).toEqual([["bbc.com"], ["bbc.com"]]);
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
    "cuts the provider's limit and the backstop to the time the capability has left",
    () =>
      Effect.gen(function* () {
        firecrawlApp.search.mockClear();
        firecrawlApp.search.mockReturnValueOnce(new Promise(() => undefined));
        const fiber = yield* Effect.forkChild(
          Effect.flip(searchFirecrawl("kurikulum merdeka")).pipe(
            withTimeLeft("3 seconds")
          )
        );
        yield* TestClock.adjust("2999 millis");
        expect(fiber.pollUnsafe()).toBeUndefined();
        yield* TestClock.adjust("1 millis");
        expect(yield* Fiber.join(fiber)).toMatchObject({
          _tag: "ResearchSearchError",
          message: "Failed to search the web. Please try again.",
        });
        expect(firecrawlApp.search).toHaveBeenLastCalledWith(
          "kurikulum merdeka",
          { limit: 5, sources: ["web", "news"], timeout: 3000 }
        );
      })
  );

  it.effect("gives a repeated search the time left at that moment", () =>
    Effect.gen(function* () {
      const asked = yield* Ref.make(0);
      const left = Effect.gen(function* () {
        const before = yield* Ref.getAndUpdate(asked, (count) => count + 1);
        return Duration.seconds(before === 0 ? 8 : 4);
      });
      firecrawlApp.search.mockClear();
      firecrawlApp.search
        .mockRejectedValueOnce(
          Object.assign(new Error("Rate limit"), { status: 429 })
        )
        .mockResolvedValueOnce({ web: [] });
      const fiber = yield* Effect.forkChild(
        searchFirecrawl("kurikulum merdeka").pipe(
          Effect.provideService(CapabilityDeadline, { left })
        )
      );
      yield* TestClock.adjust("1 second");
      yield* Fiber.join(fiber);
      expect(
        Arr.map(
          firecrawlApp.search.mock.calls,
          ([, options]) => options.timeout
        )
      ).toEqual([8000, 4000]);
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
