import { beforeEach, describe, expect, it } from "@effect/vitest";
import { CapabilityDeadline } from "@repo/backend/confect/nina/capability/deadline";
import { searchFirecrawl } from "@repo/backend/confect/nina/research/search/provider";
import { withTimeLeft } from "@repo/backend/test/nina/deadline";
import {
  inBackground,
  overProvider,
  refusal,
  searchAnswer,
  sentBodies,
} from "@repo/backend/test/nina/provider";
import { encodeJsonText } from "@repo/utilities/json";
import { Duration, Effect, Fiber, Ref } from "effect";
import { TestClock } from "effect/testing";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();
const overFetch = overProvider(fetcher);

/** What the plan's rate limit answers with when it refuses a request. */
const refused = () =>
  Promise.resolve(
    refusal(
      429,
      "Request rate limit exceeded. Please wait and try again later."
    )
  );

/** An answer without results. */
const nothing = () => Promise.resolve(searchAnswer({ web: [] }));

/** A request that the provider never answers. */
const never = () => new Promise<Response>(() => undefined);

beforeEach(() => {
  fetcher.mockReset();
});

describe("searchFirecrawl", () => {
  it.effect(
    "keeps the provider's status and never its message, which may repeat the query",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(() =>
          Promise.resolve(
            refusal(401, "Unauthorized for query kurikulum merdeka")
          )
        );

        const error = yield* Effect.flip(
          searchFirecrawl("kurikulum merdeka").pipe(overFetch)
        );

        expect(error).toMatchObject({
          _tag: "ResearchSearchError",
          message: "Failed to search the web. Please try again.",
          status: 401,
        });
        expect(encodeJsonText(error)).not.toContain("Unauthorized");
        expect(String(error)).not.toContain("Unauthorized");
      })
  );

  it.effect(
    "asks for the web and the news, five results of each, and for no page read inside the search",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(nothing);

        yield* searchFirecrawl("kurikulum merdeka").pipe(overFetch);

        expect(yield* sentBodies(fetcher)).toEqual([
          {
            query: "kurikulum merdeka",
            sources: ["web", "news"],
            limit: 5,
            timeout: 10_000,
          },
        ]);
      })
  );

  it.effect(
    "restricts the search to the sites it is given through the provider's own includeDomains field, exactly as given",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(nothing);

        yield* searchFirecrawl("kurikulum merdeka", [
          "snpmb.bppp.kemdikbud.go.id",
          "bbc.com",
        ]).pipe(overFetch);

        expect(yield* sentBodies(fetcher)).toEqual([
          {
            query: "kurikulum merdeka",
            sources: ["web", "news"],
            limit: 5,
            timeout: 10_000,
            includeDomains: ["snpmb.bppp.kemdikbud.go.id", "bbc.com"],
          },
        ]);
      })
  );

  it.effect(
    "asks again with the same sites when the rate limit refuses a restricted search, so a retry never widens it",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementationOnce(refused).mockImplementationOnce(nothing);
        const fiber = yield* inBackground(
          searchFirecrawl("kurikulum merdeka", ["bbc.com"]).pipe(overFetch)
        );

        yield* TestClock.adjust("1 second");
        yield* Fiber.join(fiber);

        expect(yield* sentBodies(fetcher)).toMatchObject([
          { includeDomains: ["bbc.com"] },
          { includeDomains: ["bbc.com"] },
        ]);
      })
  );

  it.effect("has no status when the provider never answered", () =>
    Effect.gen(function* () {
      fetcher.mockRejectedValue(new Error("socket hang up"));

      const error = yield* Effect.flip(
        searchFirecrawl("kurikulum merdeka").pipe(overFetch)
      );

      expect(error.status).toBeUndefined();
    })
  );

  it.effect(
    "settles a query the provider never answers as a failed search",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(never);
        const fiber = yield* inBackground(
          Effect.flip(searchFirecrawl("kurikulum merdeka").pipe(overFetch))
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
        expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      })
  );

  it.effect(
    "cuts the provider's limit and the backstop to the time the capability has left",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(never);
        const fiber = yield* inBackground(
          Effect.flip(searchFirecrawl("kurikulum merdeka")).pipe(
            overFetch,
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
        expect(yield* sentBodies(fetcher)).toMatchObject([{ timeout: 3000 }]);
      })
  );

  it.effect("gives a repeated search the time left at that moment", () =>
    Effect.gen(function* () {
      const asked = yield* Ref.make(0);
      const left = Effect.gen(function* () {
        const before = yield* Ref.getAndUpdate(asked, (count) => count + 1);
        return Duration.seconds(before === 0 ? 8 : 4);
      });
      fetcher.mockImplementationOnce(refused).mockImplementationOnce(nothing);
      const fiber = yield* inBackground(
        searchFirecrawl("kurikulum merdeka").pipe(
          overFetch,
          Effect.provideService(CapabilityDeadline, { left })
        )
      );

      yield* TestClock.adjust("1 second");
      yield* Fiber.join(fiber);

      expect(yield* sentBodies(fetcher)).toMatchObject([
        { timeout: 8000 },
        { timeout: 4000 },
      ]);
    })
  );

  it.effect(
    "asks once more, a second later, when the plan's rate limit refuses a search",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementationOnce(refused).mockImplementationOnce(nothing);
        const fiber = yield* inBackground(
          searchFirecrawl("kurikulum merdeka").pipe(overFetch)
        );

        yield* TestClock.adjust("999 millis");
        expect(fetcher).toHaveBeenCalledTimes(1);
        yield* TestClock.adjust("1 millis");

        expect(yield* Fiber.join(fiber)).toEqual({
          query: "kurikulum merdeka",
          response: { web: [] },
        });
        expect(fetcher).toHaveBeenCalledTimes(2);
      })
  );

  it.effect(
    "fails after the second refusal, and never asks again for any other failure",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(refused);
        const fiber = yield* inBackground(
          Effect.flip(searchFirecrawl("kurikulum merdeka").pipe(overFetch))
        );
        yield* TestClock.adjust("1 second");
        expect((yield* Fiber.join(fiber)).status).toBe(429);
        expect(fetcher).toHaveBeenCalledTimes(2);

        fetcher.mockReset();
        fetcher.mockImplementation(() =>
          Promise.resolve(new Response("", { status: 401 }))
        );
        yield* Effect.flip(
          searchFirecrawl("kurikulum merdeka").pipe(overFetch)
        );
        expect(fetcher).toHaveBeenCalledTimes(1);
      })
  );
});
