import { describe, expect, it } from "@effect/vitest";
import { searchFirecrawl } from "@repo/backend/confect/nina/research/search/provider";
import { Effect } from "effect";

const firecrawlApp = vi.hoisted(() => ({ search: vi.fn() }));

vi.mock("@repo/backend/confect/nina/research/provider", () => ({
  readFirecrawlApp: () => Effect.succeed(firecrawlApp),
}));

describe("searchFirecrawl", () => {
  it.effect(
    "keeps the provider's reason beside the message the learner sees",
    () =>
      Effect.gen(function* () {
        firecrawlApp.search.mockRejectedValueOnce(
          new Error("Unauthorized: Invalid token")
        );
        const error = yield* Effect.flip(searchFirecrawl("kurikulum merdeka"));
        expect(error).toMatchObject({
          _tag: "ResearchSearchError",
          cause: "Unauthorized: Invalid token",
          message: "Failed to search the web. Please try again.",
        });
      })
  );
});
